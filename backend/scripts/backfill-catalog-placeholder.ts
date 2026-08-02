/**
 * Replace placehold.co image URLs on products with the current catalog placeholder.
 *
 * Usage (from backend/):
 *   npx tsx scripts/backfill-catalog-placeholder.ts --dry-run
 *   npx tsx scripts/backfill-catalog-placeholder.ts --apply
 */
import {
  applyPlaceholderToImageUrls,
  getCatalogPlaceholderImageUrl,
  isGenericPlaceholderUrl,
} from '../src/services/catalog-placeholder.service'
import { pool } from '../src/utils/db'

type ProductRow = {
  id: number
  sku: string
  image_url_1: string | null
  image_url_2: string | null
  image_urls: string[] | null
}

const hasPlacehold = (row: ProductRow): boolean => {
  if (isGenericPlaceholderUrl(row.image_url_1)) return true
  if (isGenericPlaceholderUrl(row.image_url_2)) return true
  if (Array.isArray(row.image_urls) && row.image_urls.some((u) => isGenericPlaceholderUrl(u))) {
    return true
  }
  // Also catch placehold embedded only in jsonb text when array parse odd
  return false
}

const rewriteRow = (row: ProductRow, placeholder: string) => {
  const raw = Array.isArray(row.image_urls)
    ? row.image_urls.filter(Boolean)
    : [row.image_url_1, row.image_url_2].filter((u): u is string => Boolean(u))
  const imageUrls = applyPlaceholderToImageUrls(raw, placeholder)
  // If product had real photos mixed incorrectly, applyPlaceholder may keep reals;
  // only rewrite when resulting set is still placeholder-only OR original had placehold.
  const hadGeneric = raw.some(isGenericPlaceholderUrl) || raw.length === 0
  if (!hadGeneric) return null
  return {
    imageUrl1: imageUrls[0] ?? placeholder,
    imageUrl2: imageUrls[1] ?? imageUrls[0] ?? placeholder,
    imageUrls,
  }
}

const main = async () => {
  const args = new Set(process.argv.slice(2))
  const dryRun = args.has('--dry-run')
  const apply = args.has('--apply')
  if (dryRun === apply) {
    console.error('Укажите ровно один флаг: --dry-run или --apply')
    process.exit(1)
  }

  const placeholder = await getCatalogPlaceholderImageUrl()
  console.log(`[backfill-placeholder] mode=${dryRun ? 'dry-run' : 'apply'} placeholder=${placeholder}`)

  const result = await pool.query<ProductRow>(
    `SELECT id, sku, image_url_1, image_url_2, image_urls
     FROM products
     WHERE COALESCE(image_url_1, '') ILIKE '%placehold.co%'
        OR COALESCE(image_url_2, '') ILIKE '%placehold.co%'
        OR COALESCE(image_urls::text, '') ILIKE '%placehold.co%'`,
  )

  const updated: string[] = []
  const skipped: string[] = []
  const wouldUpdate: Array<{ sku: string; from: string[]; to: string[] }> = []

  for (const row of result.rows) {
    if (!hasPlacehold(row)) {
      skipped.push(row.sku)
      continue
    }
    const next = rewriteRow(row, placeholder)
    if (!next) {
      skipped.push(row.sku)
      continue
    }

    const from = Array.isArray(row.image_urls)
      ? row.image_urls
      : [row.image_url_1, row.image_url_2].filter(Boolean)

    if (dryRun) {
      wouldUpdate.push({ sku: row.sku, from: from as string[], to: next.imageUrls })
      updated.push(row.sku)
      continue
    }

    await pool.query(
      `UPDATE products
       SET image_url_1 = $1,
           image_url_2 = $2,
           image_urls = $3::jsonb,
           updated_at = NOW()
       WHERE id = $4`,
      [next.imageUrl1, next.imageUrl2, JSON.stringify(next.imageUrls), row.id],
    )
    updated.push(row.sku)
  }

  console.log(
    '[backfill-placeholder] SUMMARY',
    JSON.stringify(
      {
        mode: dryRun ? 'dry-run' : 'apply',
        matched: result.rows.length,
        updated: updated.length,
        updatedSkus: updated,
        skipped: skipped.length,
        wouldUpdate: dryRun ? wouldUpdate : undefined,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((err) => {
    console.error('[backfill-placeholder] FATAL', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
