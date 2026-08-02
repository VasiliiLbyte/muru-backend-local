/**
 * One-shot import of 38 REAL SKUs (MU0296–MU0333) from catalog-parity CSV.
 *
 * Usage (from backend/):
 *   npx tsx scripts/import-parity-38.ts --dry-run
 *   DATABASE_URL=…muru_staging… npx tsx scripts/import-parity-38.ts --apply
 *
 * Requires CATALOG_SOURCE=crm. Does not apply to prod unless DATABASE_URL points there.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createCrmCatalogProduct } from '../src/services/crm-catalog.service'
import { createCrmSubcategory } from '../src/services/crm-catalog-subcategories.service'
import {
  BOKALY_SUBCATEGORY_NAME,
  KITCHEN_CATEGORY_NAME,
  parseImportCsv,
  parseImportRow,
  type ImportParity38ProductInput,
} from '../src/services/import-parity-38.helpers'
import { env } from '../src/utils/env'
import { pool } from '../src/utils/db'

/** Run from backend/: npx tsx scripts/import-parity-38.ts … */
const DEFAULT_CSV = resolve(process.cwd(), 'scripts/data/import-38-real.csv')

type CatMaps = {
  categoryByName: Map<string, number>
  subcategoryByCatAndName: Map<string, number>
}

const loadCategoryMaps = async (): Promise<CatMaps> => {
  const cats = await pool.query<{ id: number; name: string }>(
    `SELECT id, name FROM categories ORDER BY id`,
  )
  const categoryByName = new Map(cats.rows.map((r) => [r.name, r.id]))

  const subs = await pool.query<{ id: number; category_id: number; name: string }>(
    `SELECT id, category_id, name FROM subcategories ORDER BY id`,
  )
  const subcategoryByCatAndName = new Map<string, number>()
  for (const row of subs.rows) {
    subcategoryByCatAndName.set(`${row.category_id}::${row.name}`, row.id)
  }
  return { categoryByName, subcategoryByCatAndName }
}

const ensureBokaly = async (
  maps: CatMaps,
  dryRun: boolean,
): Promise<{ status: 'exists' | 'created' | 'would_create'; categoryId: number; subcategoryId: number | null }> => {
  const categoryId = maps.categoryByName.get(KITCHEN_CATEGORY_NAME)
  if (categoryId == null) {
    throw new Error(`Категория «${KITCHEN_CATEGORY_NAME}» не найдена`)
  }
  const key = `${categoryId}::${BOKALY_SUBCATEGORY_NAME}`
  const existingId = maps.subcategoryByCatAndName.get(key)
  if (existingId != null) {
    return { status: 'exists', categoryId, subcategoryId: existingId }
  }
  if (dryRun) {
    return { status: 'would_create', categoryId, subcategoryId: null }
  }
  const created = await createCrmSubcategory(categoryId, { name: BOKALY_SUBCATEGORY_NAME })
  maps.subcategoryByCatAndName.set(key, created.id)
  return { status: 'created', categoryId, subcategoryId: created.id }
}

const resolveRow = (
  row: ImportParity38ProductInput,
  maps: CatMaps,
): { categoryId: number; subcategoryId: number } | { error: string } => {
  const categoryId = maps.categoryByName.get(row.resolvedCategoryName)
  if (categoryId == null) {
    return {
      error: `category not found: sheet="${row.sheetCategory}" resolved="${row.resolvedCategoryName}"`,
    }
  }
  const subcategoryId = maps.subcategoryByCatAndName.get(`${categoryId}::${row.subcategory}`)
  if (subcategoryId == null) {
    return {
      error: `subcategory not found: "${row.subcategory}" under "${row.resolvedCategoryName}" (id=${categoryId})`,
    }
  }
  return { categoryId, subcategoryId }
}

const skuExists = async (sku: string): Promise<boolean> => {
  const r = await pool.query(`SELECT id FROM products WHERE sku = $1`, [sku])
  return r.rows.length > 0
}

const main = async () => {
  const args = new Set(process.argv.slice(2))
  const dryRun = args.has('--dry-run')
  const apply = args.has('--apply')
  if (dryRun === apply) {
    console.error('Укажите ровно один флаг: --dry-run или --apply')
    process.exit(1)
  }

  if (env.catalogSource !== 'crm') {
    console.error(`CATALOG_SOURCE=${env.catalogSource}; нужен crm для createCrmCatalogProduct`)
    process.exit(1)
  }

  const csvPath = DEFAULT_CSV
  const rawRows = parseImportCsv(readFileSync(csvPath, 'utf8'))
  const products: ImportParity38ProductInput[] = []
  for (const raw of rawRows) {
    const parsed = parseImportRow(raw)
    if (parsed) products.push(parsed)
  }

  console.log(`[import-38] csv=${csvPath} rows=${rawRows.length} real=${products.length} mode=${dryRun ? 'dry-run' : 'apply'}`)

  const maps = await loadCategoryMaps()
  const bokaly = await ensureBokaly(maps, dryRun)
  console.log(`[import-38] Бокалы: ${bokaly.status} kitchenCategoryId=${bokaly.categoryId} subcategoryId=${bokaly.subcategoryId}`)
  if (dryRun && bokaly.status === 'would_create') {
    // Placeholder so dry-run resolves MU0296/MU0305/MU0306 as would-create, not fail.
    maps.subcategoryByCatAndName.set(`${bokaly.categoryId}::${BOKALY_SUBCATEGORY_NAME}`, -1)
  }

  const created: string[] = []
  const skippedExisting: string[] = []
  const wouldCreate: Array<{ sku: string; categoryId: number; subcategoryId: number; slug: string }> = []
  const failed: Array<{ sku: string; reason: string }> = []

  for (const row of products) {
    const resolved = resolveRow(row, maps)
    if ('error' in resolved) {
      failed.push({ sku: row.sku, reason: resolved.error })
      console.log(`[fail] ${row.sku}: ${resolved.error}`)
      continue
    }

    try {
      if (await skuExists(row.sku)) {
        skippedExisting.push(row.sku)
        console.log(`[skip] ${row.sku} already exists`)
        continue
      }

      if (dryRun) {
        wouldCreate.push({
          sku: row.sku,
          categoryId: resolved.categoryId,
          subcategoryId: resolved.subcategoryId,
          slug: row.slug,
        })
        console.log(
          `[create] ${row.sku} slug=${row.slug} cat=${resolved.categoryId} sub=${resolved.subcategoryId} new=${row.isNewArrival} stock=${row.inStock} price=${row.price}`,
        )
        continue
      }

      await createCrmCatalogProduct({
        sku: row.sku,
        name: row.name,
        slug: row.slug,
        price: row.price,
        inStock: row.inStock,
        discountPercent: row.discountPercent,
        color: row.color,
        size: row.size,
        dimensionsLabel: row.dimensionsLabel,
        colorTags: [],
        categoryId: resolved.categoryId,
        subcategoryIds: [resolved.subcategoryId],
        isNewArrival: row.isNewArrival,
      })
      created.push(row.sku)
      console.log(`[created] ${row.sku}`)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      failed.push({ sku: row.sku, reason })
      console.log(`[fail] ${row.sku}: ${reason}`)
    }
  }

  const summary = {
    mode: dryRun ? 'dry-run' : 'apply',
    real: products.length,
    bokaly: bokaly.status,
    created: dryRun ? wouldCreate.length : created.length,
    createdSkus: dryRun ? wouldCreate.map((r) => r.sku) : created,
    skippedExisting: skippedExisting.length,
    skippedSkus: skippedExisting,
    failed: failed.length,
    failedRows: failed,
    wouldCreate: dryRun ? wouldCreate : undefined,
  }
  console.log('[import-38] SUMMARY', JSON.stringify(summary, null, 2))
}

main()
  .catch((err) => {
    console.error('[import-38] FATAL', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
