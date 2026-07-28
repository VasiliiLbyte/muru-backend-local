/**
 * Backfill products.slug from S0 products_map.csv + autotranslit for the rest.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-product-slugs.ts
 *   npx tsx src/scripts/backfill-product-slugs.ts --force
 */

import { pool } from '../utils/db'
import {
  defaultProductsMapPath,
  loadFinalSlugsFromProductsMap,
  parseBackfillArgs,
  planProductSlugBackfill,
  type ProductSlugRow,
} from './backfill-product-slugs.helpers'

async function main(): Promise<void> {
  const args = parseBackfillArgs(process.argv.slice(2))
  const csvPath = defaultProductsMapPath()
  console.log(`[backfill-product-slugs] force=${args.force} csv=${csvPath}`)

  const csvSlugs = loadFinalSlugsFromProductsMap(csvPath)
  console.log(`[backfill-product-slugs] csv entries=${csvSlugs.size}`)

  const result = await pool.query<ProductSlugRow>(
    `SELECT sku, name, slug FROM products ORDER BY sku`,
  )
  const plan = planProductSlugBackfill(result.rows, csvSlugs, args)

  let updated = 0
  for (const item of plan.updates) {
    await pool.query(`UPDATE products SET slug = $1 WHERE sku = $2`, [item.slug, item.sku])
    updated += 1
  }

  console.log(
    `[backfill-product-slugs] processed=${result.rows.length} updated=${updated} skipped=${plan.skipped} fromCsv=${plan.fromCsv} auto=${plan.auto} collisions=${plan.collisions}`,
  )
}

main()
  .catch((error) => {
    console.error('[backfill-product-slugs] failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => undefined)
  })
