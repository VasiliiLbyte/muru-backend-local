import type { PoolClient } from 'pg'
import { z } from 'zod'

import { mapSheetSectionToTopLevel } from '../constants/catalog-top-level'
import type { CatalogSyncProgress, Product, SyncError, SyncResult, Variant } from '../types/catalog'
import { pool } from '../utils/db'
import { env } from '../utils/env'

import { readCatalogWithMeta } from './google-catalog-reader'
import { buildDriveThumbnailUrl } from './google-drive-muru-folder'
import {
  PLACEHOLDER_DRIVE_FILENAME,
  scanProductImagesFromDriveTree,
  type DriveImageRef,
} from './google-drive-product-images'
import {
  resolvePrimaryCatalogSection,
  resolveSheetDiscountPercent,
  resolveSheetPrice,
  resolveSkuFromRow,
} from './google-sheet-headers'
import {
  summarizeSyncErrors,
  SYNC_REASON_INVALID_ROW,
  SYNC_REASON_MISSING_SKU,
  syncDbErrorReason,
} from './google-sync-errors'
import { invalidateImageCache } from './image-proxy.service'
import { buildTwoSlotImageUrls } from './google-sync-image-urls'
import {
  estimateWeightGrams,
  parseColorTags,
  parseDimensionsLabel,
} from './google-sync-dimensions'
import { extractDriveFileId } from '../utils/drive-file-id'

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
const DB_CHUNK_SIZE = 40
const DB_PROGRESS_EVERY = 10

const STOCK_WRITE_DISABLED_WARNING =
  'Списание остатков в таблицу отключено; остаток обновляется только при синхронизации каталога.'

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

const normalizeProduct = (
  source: Record<string, string>,
  imageRefs: DriveImageRef[] | undefined,
  placeholderThumbnailUrl: string | null,
): Product | null => {
  const skuValue = resolveSkuFromRow(source)
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

  const existingSpecs = parseSpecs(source.specs ?? source['характеристики'] ?? '')
  const finalSpecs = { ...specsFromColumns, ...existingSpecs }

  const sku = parsed.data.sku.toUpperCase()
  const categoryNames = parsed.data.categories
    .split(/[>,/|]/)
    .map((item) => item.trim())
    .filter(Boolean)

  const orderedRefs = (imageRefs ?? [])
    .filter((ref) => ref.order >= 1 && ref.order <= 3)
    .sort((a, b) => a.order - b.order)
  const productUrls = orderedRefs.map((ref) => buildDriveThumbnailUrl(ref.fileId))
  const imageUrls = buildTwoSlotImageUrls(productUrls, placeholderThumbnailUrl)

  const dimsLabel = (source['размер'] ?? '').trim()
  const parsedDims = parseDimensionsLabel(dimsLabel)
  const material = finalSpecs['Материал']
  const weightGramsEstimated = parsedDims ? estimateWeightGrams(parsedDims, material) : null
  const colorRaw = (source['цвет'] ?? '').trim()
  const colorTags = parseColorTags(colorRaw)

  return {
    sku,
    name: parsed.data.name,
    categoryNames,
    price: parseNumber(parsed.data.price),
    discountPercent: resolveSheetDiscountPercent(source),
    inStock: Math.max(0, Math.floor(parseNumber(parsed.data.stock))),
    description: parsed.data.description,
    specs: finalSpecs,
    variants: parseVariants(parsed.data.variants),
    imageUrls,
    color: colorRaw || undefined,
    colorTags,
    size: dimsLabel || undefined,
    dimensionsLabel: dimsLabel,
    parsedDims,
    weightGramsEstimated,
  }
}

const ensureCategoryId = async (
  client: PoolClient,
  cache: Map<string, number>,
  categoryName: string,
): Promise<number> => {
  const cached = cache.get(categoryName)
  if (cached !== undefined) return cached

  const categorySlug = slugify(categoryName)
  const categoryResult = await client.query<{ id: number }>(
    `INSERT INTO categories (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (name)
     DO UPDATE SET slug = EXCLUDED.slug
     RETURNING id`,
    [categoryName, categorySlug],
  )
  const id = categoryResult.rows[0].id
  cache.set(categoryName, id)
  return id
}

const upsertProductWithClient = async (
  client: PoolClient,
  product: Product,
  categoryId: number,
): Promise<void> => {
  const existing = await client.query<{ dims_source: string; weight_source: string }>(
    `SELECT dims_source, weight_source FROM products WHERE sku = $1`,
    [product.sku],
  )
  const dimsManual = existing.rows[0]?.dims_source === 'manual'
  const weightManual = existing.rows[0]?.weight_source === 'manual'

  const imageUrl1 = product.imageUrls[0] ?? DEFAULT_IMAGE_URL
  const imageUrl2 = product.imageUrls[1] ?? imageUrl1
  const productResult = await client.query<{ id: number }>(
    `INSERT INTO products (sku, name, description, price, discount_percent, in_stock, specs, image_url_1, image_url_2, image_urls, category_id, color, color_tags, size, dimensions_label, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,NOW())
     ON CONFLICT (sku)
     DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       price = EXCLUDED.price,
       discount_percent = EXCLUDED.discount_percent,
       in_stock = EXCLUDED.in_stock,
       specs = EXCLUDED.specs,
       image_url_1 = EXCLUDED.image_url_1,
       image_url_2 = EXCLUDED.image_url_2,
       image_urls = EXCLUDED.image_urls,
       category_id = EXCLUDED.category_id,
       color = EXCLUDED.color,
       color_tags = EXCLUDED.color_tags,
       size = EXCLUDED.size,
       dimensions_label = EXCLUDED.dimensions_label,
       updated_at = NOW()
     RETURNING id`,
    [
      product.sku,
      product.name,
      product.description,
      product.price,
      product.discountPercent,
      product.inStock,
      JSON.stringify(product.specs),
      imageUrl1,
      imageUrl2,
      JSON.stringify(product.imageUrls),
      categoryId,
      product.color ?? null,
      product.colorTags ?? [],
      product.size ?? null,
      product.dimensionsLabel ?? '',
    ],
  )

  if (product.parsedDims && !dimsManual) {
    await client.query(
      `UPDATE products
       SET dim_length_cm = $1, dim_width_cm = $2, dim_height_cm = $3, dims_source = 'auto'
       WHERE sku = $4 AND dims_source = 'auto'`,
      [
        product.parsedDims.lengthCm,
        product.parsedDims.widthCm,
        product.parsedDims.heightCm,
        product.sku,
      ],
    )
  }

  if (product.weightGramsEstimated != null && !weightManual) {
    await client.query(
      `UPDATE products SET weight_grams = $1, weight_source = 'auto'
       WHERE sku = $2 AND weight_source = 'auto'`,
      [product.weightGramsEstimated, product.sku],
    )
  }

  const productId = productResult.rows[0].id
  await client.query('DELETE FROM variants WHERE product_id = $1', [productId])

  for (const variant of product.variants) {
    await client.query(`INSERT INTO variants (product_id, color, size) VALUES ($1, $2, $3)`, [
      productId,
      variant.color ?? null,
      variant.size ?? null,
    ])
  }
}

const upsertOneProductIsolated = async (product: Product): Promise<void> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const primaryCategory = mapSheetSectionToTopLevel(product.categoryNames[0] ?? '')
    const categoryId = await ensureCategoryId(client, new Map(), primaryCategory)
    await upsertProductWithClient(client, product, categoryId)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const upsertProductsBatched = async (
  products: Product[],
  onProgress?: (progress: CatalogSyncProgress) => void,
): Promise<{ synced: number; errors: SyncError[] }> => {
  const errors: SyncError[] = []
  let synced = 0
  const total = products.length
  const client = await pool.connect()
  const categoryCache = new Map<string, number>()

  try {
    for (let offset = 0; offset < products.length; offset += DB_CHUNK_SIZE) {
      const chunk = products.slice(offset, offset + DB_CHUNK_SIZE)
      try {
        await client.query('BEGIN')
        for (const product of chunk) {
          const primaryCategory = mapSheetSectionToTopLevel(product.categoryNames[0] ?? '')
          const categoryId = await ensureCategoryId(client, categoryCache, primaryCategory)
          await upsertProductWithClient(client, product, categoryId)
        }
        await client.query('COMMIT')
        synced += chunk.length
      } catch {
        await client.query('ROLLBACK')
        for (const product of chunk) {
          try {
            await upsertOneProductIsolated(product)
            synced += 1
          } catch (error) {
            const dbReason = error instanceof Error ? error.message : 'Unknown DB error'
            errors.push({ sku: product.sku, reason: syncDbErrorReason(dbReason) })
          }
        }
      }

      if (synced % DB_PROGRESS_EVERY === 0 || synced === total) {
        onProgress?.({
          phase: 'database',
          message: `Записано в каталог: ${synced} / ${total}`,
          processedProducts: synced,
          totalProducts: total,
        })
      }
    }
  } finally {
    client.release()
  }

  return { synced, errors }
}

export type CatalogSyncProgressCallback = (progress: CatalogSyncProgress) => void

export const syncCatalogFromGoogle = async (
  onProgress?: CatalogSyncProgressCallback,
): Promise<SyncResult> => {
  const startedAt = Date.now()
  const report = (progress: CatalogSyncProgress) => onProgress?.(progress)

  const driveScanPromise = scanProductImagesFromDriveTree((update) => {
    report({
      phase: 'drive',
      message: update.message,
      foldersScanned: update.foldersScanned,
      imagesSeen: update.imagesSeen,
    })
  })

  const sheetPromise = readCatalogWithMeta((message) => {
    report({ phase: 'sheet', message })
  })

  const [sheetData, driveScan] = await Promise.all([sheetPromise, driveScanPromise])
  const { title: sheetTitle, rows } = sheetData

  report({
    phase: 'sheet',
    message: `Источник «${sheetTitle || '—'}»: ${rows.length} строк`,
  })

  const driveImageMap = driveScan.bySku
  const placeholderFileId = driveScan.placeholderFileId
  const placeholderThumbnailUrl = placeholderFileId ? buildDriveThumbnailUrl(placeholderFileId) : null

  const warnings: string[] = [...driveScan.warnings]
  if (!env.enableSheetsStockWrite) {
    warnings.push(STOCK_WRITE_DISABLED_WARNING)
  }
  if (!placeholderFileId) {
    const msg = `В папке Drive нет файла «${PLACEHOLDER_DRIVE_FILENAME}»; для товаров без фото будет внешняя заглушка.`
    warnings.push(msg)
    console.warn(`[sync] ${msg}`)
  } else {
    console.log('[sync] Drive catalog placeholder resolved for missing product images')
  }

  console.log(`[sync] Drive images found: ${driveImageMap.size} SKUs with images`)

  const errors: SyncError[] = []
  let skippedProducts = 0
  let skippedByRule = 0
  const productsToUpsert: Product[] = []
  const touchedFileIds = new Set<string>()

  if (placeholderFileId) {
    touchedFileIds.add(placeholderFileId)
  }

  for (const row of rows) {
    const sku = resolveSkuFromRow(row)
    if (!sku) {
      skippedProducts += 1
      errors.push({ sku: '—', reason: SYNC_REASON_MISSING_SKU })
      continue
    }
    if (!sku.startsWith('MU')) {
      skippedProducts += 1
      skippedByRule += 1
      continue
    }

    const imageRefs = driveImageMap.get(sku)
    if (imageRefs) {
      for (const ref of imageRefs) {
        if (ref.order >= 1 && ref.order <= 3) {
          touchedFileIds.add(ref.fileId)
        }
      }
    }

    const product = normalizeProduct(row, imageRefs, placeholderThumbnailUrl)
    if (!product) {
      skippedProducts += 1
      errors.push({ sku, reason: SYNC_REASON_INVALID_ROW })
      continue
    }

    for (const url of product.imageUrls) {
      const id = extractDriveFileId(url)
      if (id) touchedFileIds.add(id)
    }

    productsToUpsert.push(product)
  }

  report({
    phase: 'database',
    message: `Записываем в каталог: ${productsToUpsert.length} товаров…`,
    totalProducts: productsToUpsert.length,
    processedProducts: 0,
  })

  const { synced, errors: dbErrors } = await upsertProductsBatched(productsToUpsert, report)
  errors.push(...dbErrors)

  if (touchedFileIds.size > 0) {
    try {
      await invalidateImageCache([...touchedFileIds])
      console.log(`[sync] Image cache invalidated for ${touchedFileIds.size} Drive file(s)`)
    } catch (invalidateError) {
      console.error('[sync] Image cache invalidate failed', invalidateError)
    }
  }

  const { errors: cappedErrors, errorGroups } = summarizeSyncErrors(errors)

  const durationMs = Date.now() - startedAt

  report({
    phase: 'done',
    message: `Готово: синхронизировано ${synced} товаров за ${Math.round(durationMs / 1000)} с.`,
    processedProducts: synced,
    totalProducts: productsToUpsert.length,
  })

  return {
    totalRows: rows.length,
    syncedProducts: synced,
    skippedProducts,
    skippedByRule,
    errors: cappedErrors,
    errorGroups,
    durationMs,
    sheetTitle: sheetTitle || undefined,
    driveFoldersScanned: driveScan.foldersScanned,
    driveImagesSeen: driveScan.imagesSeen,
    driveImagesMatched: driveScan.imagesMatched,
    driveSkusWithImages: driveImageMap.size,
    ...(warnings.length > 0 ? { warnings } : {}),
  }
}
