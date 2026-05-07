import { google } from 'googleapis'
import { z } from 'zod'

import type { Product, SyncError, SyncResult, Variant } from '../types/catalog'
import { pool } from '../utils/db'
import { env } from '../utils/env'

const rowSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  categories: z.string().default(''),
  price: z.union([z.string(), z.number()]).optional(),
  stock: z.union([z.string(), z.number()]).optional(),
  description: z.string().default(''),
  specs: z.string().default(''),
  variants: z.string().default(''),
})

type DriveImageRef = { order: number; fileId: string }
const DEFAULT_IMAGE_URL = 'https://placehold.co/1200x1200?text=MURU'

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

const parseNumber = (value: string | number | undefined) => {
  if (typeof value === 'number') return value
  if (!value) return 0
  const normalized = String(value).replace(',', '.').replace(/[^\d.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseSpecs = (raw: string): Record<string, string> => {
  if (!raw.trim()) return {}
  return raw.split(';').reduce<Record<string, string>>((acc, pair) => {
    const [key, value] = pair.split(':').map((item) => item.trim())
    if (key && value) acc[key] = value
    return acc
  }, {})
}

const parseVariants = (raw: string): Variant[] => {
  if (!raw.trim()) return []
  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [colorPart, sizePart] = item.split('|').map((part) => part.trim())
      return {
        color: colorPart || undefined,
        size: sizePart || undefined,
      }
    })
}

const extractSkuAndOrder = (filename: string): { sku: string; order: number } | null => {
  const match = filename.match(/^(MU\d{4})-(\d+)\.webp$/i)
  if (!match) return null
  const parsedOrder = Number(match[2])
  if (!Number.isInteger(parsedOrder) || parsedOrder < 1) return null
  return {
    sku: match[1].toUpperCase(),
    order: parsedOrder,
  }
}

const buildPublicUrl = (fileId: string) =>
  `https://drive.google.com/uc?export=view&id=${fileId}`

const createGoogleAuth = () =>
  new google.auth.JWT({
    email: env.googleServiceAccountEmail,
    key: env.googlePrivateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  })

const readSheetRows = async () => {
  const auth = createGoogleAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheetId,
    range: 'A1:Z',
  })

  const rows = response.data.values ?? []
  if (rows.length < 2) return []

  const header = rows[0].map((cell) => String(cell).trim().toLowerCase())
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {}
    header.forEach((key, index) => {
      record[key] = String(row[index] ?? '').trim()
    })
    return record
  })
}

const readDriveImagesBySku = async () => {
  const auth = createGoogleAuth()
  const drive = google.drive({ version: 'v3', auth })

  const result = await drive.files.list({
    q: `'${env.googleDriveFolderId}' in parents and mimeType='image/webp' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 1000,
  })

  const files = result.data.files ?? []
  const map = new Map<string, DriveImageRef[]>()

  for (const file of files) {
    if (!file.id || !file.name) continue
    const parsed = extractSkuAndOrder(file.name)
    if (!parsed) continue

    const current = map.get(parsed.sku) ?? []
    current.push({ order: parsed.order, fileId: file.id })
    map.set(parsed.sku, current)
  }

  return map
}

const normalizeProduct = (
  source: Record<string, string>,
  imageRefs: DriveImageRef[] | undefined,
): Product | null => {
  const section = source.section ?? source['раздел'] ?? ''
  const subsection = source.subsection ?? source['подраздел'] ?? ''
  const normalizedCategories = [section, subsection].filter((item) => item.trim().length > 0).join(' > ')
  const parsed = rowSchema.safeParse({
    sku: source.sku ?? source['артикул'] ?? '',
    name: source.name ?? source['название'] ?? '',
    categories: normalizedCategories || source.categories || source['категории'] || '',
    price: source.price ?? source['цена'],
    stock: source.stock ?? source['наличие'],
    description: source.description ?? source['описание'] ?? '',
    specs: source.specs ?? source['характеристики'] ?? '',
    variants: source.variants ?? source['варианты'] ?? '',
  })

  if (!parsed.success) return null

  const sku = parsed.data.sku.toUpperCase()
  const categoryNames = parsed.data.categories
    .split(/[>,/|]/)
    .map((item) => item.trim())
    .filter(Boolean)

  const orderedRefs = (imageRefs ?? []).sort((a, b) => a.order - b.order)

  return {
    sku,
    name: parsed.data.name,
    categoryNames,
    price: parseNumber(parsed.data.price),
    inStock: Math.max(0, Math.floor(parseNumber(parsed.data.stock))),
    description: parsed.data.description,
    specs: parseSpecs(parsed.data.specs),
    variants: parseVariants(parsed.data.variants),
    imageUrls: orderedRefs.map((ref) => buildPublicUrl(ref.fileId)),
  }
}

const upsertProduct = async (product: Product) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const primaryCategory = product.categoryNames[0] ?? 'Без категории'
    const categorySlug = slugify(primaryCategory)

    const categoryResult = await client.query<{ id: number }>(
      `INSERT INTO categories (name, slug)
       VALUES ($1, $2)
       ON CONFLICT (name)
       DO UPDATE SET slug = EXCLUDED.slug
       RETURNING id`,
      [primaryCategory, categorySlug],
    )
    const categoryId = categoryResult.rows[0].id

    const imageUrl1 = product.imageUrls[0] ?? DEFAULT_IMAGE_URL
    const imageUrl2 = product.imageUrls[1] ?? imageUrl1
    const productResult = await client.query<{ id: number }>(
      `INSERT INTO products (sku, name, description, price, in_stock, specs, image_url_1, image_url_2, image_urls, category_id, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10,NOW())
       ON CONFLICT (sku)
       DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         price = EXCLUDED.price,
         in_stock = EXCLUDED.in_stock,
         specs = EXCLUDED.specs,
         image_url_1 = EXCLUDED.image_url_1,
         image_url_2 = EXCLUDED.image_url_2,
         image_urls = EXCLUDED.image_urls,
         category_id = EXCLUDED.category_id,
         updated_at = NOW()
       RETURNING id`,
      [
        product.sku,
        product.name,
        product.description,
        product.price,
        product.inStock,
        JSON.stringify(product.specs),
        imageUrl1,
        imageUrl2,
        JSON.stringify(product.imageUrls),
        categoryId,
      ],
    )

    const productId = productResult.rows[0].id
    await client.query('DELETE FROM variants WHERE product_id = $1', [productId])

    for (const variant of product.variants) {
      await client.query(
        `INSERT INTO variants (product_id, color, size) VALUES ($1, $2, $3)`,
        [productId, variant.color ?? null, variant.size ?? null],
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const syncCatalogFromGoogle = async (): Promise<SyncResult> => {
  const [rows, driveImageMap] = await Promise.all([readSheetRows(), readDriveImagesBySku()])
  const errors: SyncError[] = []
  let syncedProducts = 0
  let skippedProducts = 0

  for (const row of rows) {
    const skuRaw = row.sku ?? row['артикул'] ?? ''
    const sku = skuRaw.toUpperCase()
    if (!sku) {
      skippedProducts += 1
      errors.push({ sku: 'UNKNOWN', reason: 'Missing SKU in spreadsheet row' })
      continue
    }
    if (!sku.startsWith('MU')) {
      skippedProducts += 1
      errors.push({ sku, reason: 'Skipped: SKU does not start with MU' })
      continue
    }

    const product = normalizeProduct(row, driveImageMap.get(sku))
    if (!product) {
      skippedProducts += 1
      errors.push({ sku, reason: 'Invalid row data' })
      continue
    }

    try {
      await upsertProduct(product)
      syncedProducts += 1
    } catch {
      skippedProducts += 1
      errors.push({ sku, reason: 'Database upsert failed' })
    }
  }

  return {
    totalRows: rows.length,
    syncedProducts,
    skippedProducts,
    errors,
  }
}
