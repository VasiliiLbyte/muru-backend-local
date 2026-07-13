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
  WEB_CROSS_SUB_KEY,
  WEB_CROSS_TOP_KEY,
  WEB_PRIMARY_SUB_KEY,
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
import {
  collectActiveSkus,
  dedupeProductsBySkuLastWins,
  formatStalePurgeWarning,
  purgeProductsAbsentFromSheet,
} from './google-sync-stale-products'
import { PRODUCT_UPSERT_VALUES_SQL } from './google-sync-upsert-sql'
import { extractDriveFileId } from '../utils/drive-file-id'
import { CATALOG_SPEC_MAPPING } from './crm-catalog-sheet-map'

type SyncProduct = Product & {
  webSubcategoryName: string | null
  webSubcategorySlug: string | null
  webCrossTop: string | null
  webCrossSub: string | null
}

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
): SyncProduct | null => {
  const skuValue = resolveSkuFromRow(source)
  const primarySection = resolvePrimaryCatalogSection(source)
  const webSubRaw = source[WEB_PRIMARY_SUB_KEY]?.trim() ?? ''
  const webSubcategoryName = webSubRaw || null
  const webSubcategorySlug = webSubRaw ? slugify(webSubRaw) : null
  const webCrossTopRaw = source[WEB_CROSS_TOP_KEY]?.trim() ?? ''
  const webCrossTop = webCrossTopRaw || null
  const webCrossSubRaw = source[WEB_CROSS_SUB_KEY]?.trim() ?? ''
  const webCrossSub = webCrossSubRaw || null
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
  for (const [sheetKey, displayName] of Object.entries(CATALOG_SPEC_MAPPING)) {
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
    webSubcategoryName,
    webSubcategorySlug,
    webCrossTop,
    webCrossSub,
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

const upsertWebCrossPlacement = async (
  client: PoolClient,
  cache: Map<string, number>,
  productId: number,
  crossTop: string | null,
  crossSub: string | null,
): Promise<void> => {
  if (!crossTop?.trim()) {
    await client.query('DELETE FROM product_web_cross_placements WHERE product_id = $1', [productId])
    return
  }

  const categoryName = mapSheetSectionToTopLevel(crossTop.trim())
  const categoryId = await ensureCategoryId(client, cache, categoryName)
  const subName = crossSub?.trim() || null
  const subSlug = subName ? slugify(subName) : null

  await client.query(
    `INSERT INTO product_web_cross_placements (product_id, category_id, subcategory_name, subcategory_slug)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (product_id)
     DO UPDATE SET
       category_id = EXCLUDED.category_id,
       subcategory_name = EXCLUDED.subcategory_name,
       subcategory_slug = EXCLUDED.subcategory_slug`,
    [productId, categoryId, subName, subSlug],
  )
}

const upsertProductWithClient = async (
  client: PoolClient,
  product: SyncProduct,
  categoryId: number,
  categoryCache: Map<string, number>,
): Promise<void> => {
  const imageUrl1 = product.imageUrls[0] ?? DEFAULT_IMAGE_URL
  const imageUrl2 = product.imageUrls[1] ?? imageUrl1
  const productResult = await client.query<{ id: number }>(
    `INSERT INTO products (sku, name, description, price, discount_percent, in_stock, specs, image_url_1, image_url_2, image_urls, category_id, color, color_tags, size, dimensions_label, web_subcategory_name, web_subcategory_slug, updated_at)
     VALUES ${PRODUCT_UPSERT_VALUES_SQL}
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
       web_subcategory_name = EXCLUDED.web_subcategory_name,
       web_subcategory_slug = EXCLUDED.web_subcategory_slug,
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
      product.webSubcategoryName,
      product.webSubcategorySlug,
    ],
  )

  const productId = productResult.rows[0].id
  await upsertWebCrossPlacement(
    client,
    categoryCache,
    productId,
    product.webCrossTop,
    product.webCrossSub,
  )
  await client.query('DELETE FROM variants WHERE product_id = $1', [productId])

  for (const variant of product.variants) {
    await client.query(`INSERT INTO variants (product_id, color, size) VALUES ($1, $2, $3)`, [
      productId,
      variant.color ?? null,
      variant.size ?? null,
    ])
  }
}

const upsertOneProductIsolated = async (product: SyncProduct): Promise<void> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const primaryCategory = mapSheetSectionToTopLevel(product.categoryNames[0] ?? '')
    const categoryId = await ensureCategoryId(client, new Map(), primaryCategory)
    const categoryCache = new Map<string, number>()
    await upsertProductWithClient(client, product, categoryId, categoryCache)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const upsertProductsBatched = async (
  products: SyncProduct[],
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
          await upsertProductWithClient(client, product, categoryId, categoryCache)
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

export type CatalogImportRowResult = {
  row: number
  sku: string
  action: 'create' | 'update' | 'skip'
  error?: string
}

export type CatalogImportResult = {
  dryRun: boolean
  totalRows: number
  parsed: number
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; sku?: string; message: string }>
}

export const normalizeProductFromSheetRow = (
  source: Record<string, string>,
): SyncProduct | null => normalizeProduct(source, undefined, null)

export const importCatalogProductsFromRows = async (
  rows: Record<string, string>[],
  options?: { dryRun?: boolean; rowOffset?: number },
): Promise<CatalogImportResult> => {
  const dryRun = options?.dryRun ?? false
  const rowOffset = options?.rowOffset ?? 2
  const totalRows = rows.length
  const errors: CatalogImportResult['errors'] = []
  const validProducts: Array<{ row: number; product: SyncProduct }> = []

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = rowOffset + index + 1
    const product = normalizeProductFromSheetRow(rows[index])
    if (!product) {
      errors.push({ row: rowNumber, message: 'Invalid row' })
      continue
    }
    validProducts.push({ row: rowNumber, product })
  }

  const deduped = dedupeProductsBySkuLastWins(validProducts.map((item) => item.product)) as SyncProduct[]
  const parsed = deduped.length
  let skipped = totalRows - validProducts.length

  const skus = deduped.map((p) => p.sku)
  let existingSkus = new Set<string>()
  if (skus.length > 0) {
    const result = await pool.query<{ sku: string }>(
      'SELECT sku FROM products WHERE sku = ANY($1::text[])',
      [skus],
    )
    existingSkus = new Set(result.rows.map((r) => r.sku))
  }

  let created = 0
  let updated = 0
  for (const product of deduped) {
    if (existingSkus.has(product.sku)) {
      updated += 1
    } else {
      created += 1
    }
  }

  if (dryRun) {
    return {
      dryRun: true,
      totalRows,
      parsed,
      created,
      updated,
      skipped,
      errors,
    }
  }

  const { synced, errors: dbErrors } = await upsertProductsBatched(deduped)
  for (const dbError of dbErrors) {
    errors.push({ row: 0, sku: dbError.sku, message: dbError.reason })
  }

  if (synced < deduped.length) {
    skipped += deduped.length - synced
  }

  return {
    dryRun: false,
    totalRows,
    parsed,
    created,
    updated,
    skipped,
    errors,
  }
}

export type CatalogSyncProgressCallback = (progress: CatalogSyncProgress) => void

export const syncCatalogFromGoogle = async (
  onProgress?: CatalogSyncProgressCallback,
): Promise<SyncResult> => {
  if (env.isCatalogCrmMode) {
    return {
      totalRows: 0,
      syncedProducts: 0,
      skippedProducts: 0,
      skippedByRule: 0,
      errors: [],
      warnings: ['Catalog source is crm; sync skipped'],
    }
  }

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
  const productsToUpsert: SyncProduct[] = []
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

  const dedupedProducts = dedupeProductsBySkuLastWins(productsToUpsert) as SyncProduct[]
  const activeSkus = collectActiveSkus(dedupedProducts)

  const { synced, errors: dbErrors } = await upsertProductsBatched(dedupedProducts, report)
  errors.push(...dbErrors)

  let deletedProducts = 0
  let deletedSkus: string[] = []
  if (activeSkus.length > 0) {
    const purgeClient = await pool.connect()
    try {
      report({
        phase: 'database',
        message: 'Удаляем позиции, которых нет в таблице…',
        processedProducts: synced,
        totalProducts: dedupedProducts.length,
      })
      const purge = await purgeProductsAbsentFromSheet(purgeClient, activeSkus)
      deletedProducts = purge.deletedCount
      deletedSkus = purge.deletedSkus
      if (deletedProducts > 0) {
        console.log(
          `[sync] Purged ${deletedProducts} stale product(s): ${deletedSkus.slice(0, 10).join(', ')}${deletedSkus.length > 10 ? '…' : ''}`,
        )
        const purgeWarning = formatStalePurgeWarning(deletedSkus)
        if (purgeWarning) warnings.push(purgeWarning)
      }
    } finally {
      purgeClient.release()
    }
  }

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
    message:
      deletedProducts > 0
        ? `Готово: синхронизировано ${synced} товаров, удалено ${deletedProducts} устаревших за ${Math.round(durationMs / 1000)} с.`
        : `Готово: синхронизировано ${synced} товаров за ${Math.round(durationMs / 1000)} с.`,
    processedProducts: synced,
    totalProducts: dedupedProducts.length,
  })

  return {
    totalRows: rows.length,
    syncedProducts: synced,
    skippedProducts,
    skippedByRule,
    deletedProducts,
    deletedSkusSample: deletedSkus.slice(0, 10),
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
