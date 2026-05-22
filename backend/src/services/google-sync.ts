import { google } from 'googleapis'
import { z } from 'zod'

import { mapSheetSectionToTopLevel } from '../constants/catalog-top-level'
import type { Product, SyncError, SyncResult, Variant } from '../types/catalog'
import { pool } from '../utils/db'
import { env } from '../utils/env'

import {
  findHeaderRowIndex,
  isSkuHeader,
  normalizeHeaderKey,
  resolvePrimaryCatalogSection,
  resolveSheetPrice,
  rowToRecord,
  SHEET_VALUE_RANGE,
} from './google-sheet-headers'
import { buildDriveThumbnailUrl } from './google-drive-muru-folder'
import {
  PLACEHOLDER_DRIVE_FILENAME,
  scanProductImagesFromDriveTree,
  type DriveImageRef,
} from './google-drive-product-images'
import { buildTwoSlotImageUrls } from './google-sync-image-urls'

const rowSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  categories: z.string().default(''),
  price: z.union([z.string(), z.number()]).optional(),
  stock: z.union([z.string(), z.number()]).optional(),
  description: z.string().default(''),
  specs: z.string().optional().default(''),
  variants: z.string().default(''),
})

const DEFAULT_IMAGE_URL = 'https://placehold.co/1200x1200?text=MURU'

const slugify = (value: string) =>
  (value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё-]/gi, '') || 'bez-kategorii')

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

const createGoogleAuth = () =>
  new google.auth.JWT({
    email: env.googleServiceAccountEmail,
    key: env.googlePrivateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive',
    ],
  })

const detectSheetWithHeaders = async (
  sheetsApi: ReturnType<typeof google.sheets>,
): Promise<{ title: string; rows: string[][]; headerRowIndex: number } | null> => {
  const metadata = await sheetsApi.spreadsheets.get({
    spreadsheetId: env.googleSheetId,
    fields: 'sheets(properties(title))',
  })
  const titles =
    metadata.data.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)) ?? []

  // Prefer explicit sheet first if it exists, then scan all others.
  const orderedTitles = ['Лист1', ...titles.filter((title) => title !== 'Лист1')]

  for (const title of orderedTitles) {
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: env.googleSheetId,
      range: `${title}!${SHEET_VALUE_RANGE}`,
    })
    const rows = response.data.values ?? []
    if (rows.length < 2) continue

    const headerRowIndex = findHeaderRowIndex(rows)
    const header = rows[headerRowIndex].map((cell) => normalizeHeaderKey(String(cell ?? '')))
    if (header.some((key) => isSkuHeader(key))) {
      return { title, rows, headerRowIndex }
    }
  }

  return null
}

const readSheetRows = async () => {
  const auth = createGoogleAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const detected = await detectSheetWithHeaders(sheets)
  if (!detected) return []

  const { title, rows, headerRowIndex } = detected
  const header = rows[headerRowIndex].map((cell) => normalizeHeaderKey(String(cell)))
  console.log('[sync] Sheet selected:', title)
  console.log('[sync] Sheet headers found:', header.join(', '))
  return rows.slice(headerRowIndex + 1).map((row) => rowToRecord(header, row.map((cell) => String(cell ?? ''))))
}

const normalizeProduct = (
  source: Record<string, string>,
  imageRefs: DriveImageRef[] | undefined,
  placeholderThumbnailUrl: string | null,
): Product | null => {
  const skuValue =
    source.sku ??
    source['артикул'] ??
    source['артикул товара'] ??
    source['артикул товара для сайта'] ??
    source['sku/артикул'] ??
    source['артикул/sku'] ??
    source['код товара'] ??
    ''
  const primarySection = resolvePrimaryCatalogSection(source)
  const normalizedCategories = primarySection.trim()
  const parsed = rowSchema.safeParse({
    sku: skuValue,
    name: source.name ?? source['название'] ?? source['наименование товара'] ?? '',
    categories: normalizedCategories,
    price: resolveSheetPrice(source),
    stock: source.stock ?? source['наличие'] ?? source['фактический остаток'],
    description:
      source.description ??
      source['описание'] ??
      source['подробная информация (описание)'] ??
      '',
    specs: '',
    variants: source.variants ?? source['варианты'] ?? '',
  })

  if (!parsed.success) return null

  // Собираем specs из отдельных колонок таблицы
  const specsFromColumns: Record<string, string> = {}
  const specMapping: Record<string, string> = {
    бренд: 'Бренд',
    материал: 'Материал',
    'плотность ткани': 'Плотность ткани',
    дизайн: 'Дизайн',
    тип: 'Тип',
    'размер наволочки': 'Размер наволочки',
    'размер пододеяльника': 'Размер пододеяльника',
    'размер простыни': 'Размер простыни',
    'страна производитель': 'Страна',
    ингредиенты: 'Ингредиенты',
    происхождение: 'Происхождение',
    упаковка: 'Упаковка',
  }
  for (const [sheetKey, displayName] of Object.entries(specMapping)) {
    const val = source[sheetKey]?.trim()
    if (val) specsFromColumns[displayName] = val
  }

  // Если была колонка "характеристики" в формате key:value — мержим
  const existingSpecs = parseSpecs(source.specs ?? source['характеристики'] ?? '')
  const finalSpecs = { ...specsFromColumns, ...existingSpecs }

  const sku = parsed.data.sku.toUpperCase()
  const categoryNames = parsed.data.categories
    .split(/[>,/|]/)
    .map((item) => item.trim())
    .filter(Boolean)

  const orderedRefs = (imageRefs ?? [])
    .filter((ref) => ref.order === 1 || ref.order === 2)
    .sort((a, b) => a.order - b.order)
  const productUrls = orderedRefs.map((ref) => buildDriveThumbnailUrl(ref.fileId))
  const imageUrls = buildTwoSlotImageUrls(productUrls, placeholderThumbnailUrl)

  return {
    sku,
    name: parsed.data.name,
    categoryNames,
    price: parseNumber(parsed.data.price),
    inStock: Math.max(0, Math.floor(parseNumber(parsed.data.stock))),
    description: parsed.data.description,
    specs: finalSpecs,
    variants: parseVariants(parsed.data.variants),
    imageUrls,
    color: source['цвет']?.trim() || undefined,
    size: source['размер']?.trim() || undefined,
  }
}

const upsertProduct = async (product: Product) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const primaryRaw = product.categoryNames[0] ?? ''
    const primaryCategory = mapSheetSectionToTopLevel(primaryRaw)
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
      `INSERT INTO products (sku, name, description, price, in_stock, specs, image_url_1, image_url_2, image_urls, category_id, color, size, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10,$11,$12,NOW())
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
         color = EXCLUDED.color,
         size = EXCLUDED.size,
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
        product.color ?? null,
        product.size ?? null,
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
  const [rows, driveScan] = await Promise.all([readSheetRows(), scanProductImagesFromDriveTree()])
  const driveImageMap = driveScan.bySku
  const placeholderFileId = driveScan.placeholderFileId
  const placeholderThumbnailUrl = placeholderFileId ? buildDriveThumbnailUrl(placeholderFileId) : null

  const warnings: string[] = [...driveScan.warnings]
  if (!placeholderFileId) {
    const msg = `Drive folder has no "${PLACEHOLDER_DRIVE_FILENAME}" placeholder; missing product images will use the default remote placeholder.`
    warnings.push(msg)
    console.warn(`[sync] ${msg}`)
  } else {
    console.log('[sync] Drive catalog placeholder resolved for missing product images')
  }

  console.log(`[sync] Drive images found: ${driveImageMap.size} SKUs with images`)
  if (driveImageMap.size > 0) {
    const sample = [...driveImageMap.entries()].slice(0, 3)
    console.log('[sync] Image samples:', sample.map(([sku, refs]) => `${sku}: ${refs.length} files`).join(', '))
  }
  const errors: SyncError[] = []
  let syncedProducts = 0
  let skippedProducts = 0
  let skippedByRule = 0

  for (const row of rows) {
    const skuRaw =
      row.sku ??
      row['артикул'] ??
      row['артикул товара'] ??
      row['артикул товара для сайта'] ??
      row['sku/артикул'] ??
      row['артикул/sku'] ??
      row['код товара'] ??
      ''
    const sku = skuRaw.toUpperCase()
    if (!sku) {
      skippedProducts += 1
      errors.push({ sku: 'UNKNOWN', reason: 'Missing SKU in spreadsheet row' })
      continue
    }
    if (!sku.startsWith('MU')) {
      skippedProducts += 1
      skippedByRule += 1
      continue
    }

    const product = normalizeProduct(row, driveImageMap.get(sku), placeholderThumbnailUrl)
    if (!product) {
      skippedProducts += 1
      errors.push({ sku, reason: 'Invalid row data' })
      continue
    }

    try {
      await upsertProduct(product)
      syncedProducts += 1
    } catch (error) {
      skippedProducts += 1
      const dbReason = error instanceof Error ? error.message : 'Unknown DB error'
      errors.push({ sku, reason: `Database upsert failed: ${dbReason}` })
    }
  }

  return {
    totalRows: rows.length,
    syncedProducts,
    skippedProducts,
    skippedByRule,
    errors,
    ...(warnings.length > 0 ? { warnings } : {}),
  }
}
