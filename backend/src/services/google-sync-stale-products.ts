import type { PoolClient } from 'pg'

import type { Product } from '../types/catalog'

export const STALE_PURGE_SKU_SAMPLE_LIMIT = 10

/** Last spreadsheet row wins when the same SKU appears more than once. */
export const dedupeProductsBySkuLastWins = (products: Product[]): Product[] => {
  const bySku = new Map<string, Product>()
  for (const product of products) {
    bySku.set(product.sku, product)
  }
  return [...bySku.values()]
}

export const collectActiveSkus = (products: Product[]): string[] =>
  dedupeProductsBySkuLastWins(products).map((product) => product.sku)

export const shouldPurgeStaleProducts = (activeSkus: string[]): boolean => activeSkus.length > 0

export const formatStalePurgeWarning = (deletedSkus: string[]): string | null => {
  if (deletedSkus.length === 0) return null
  const sample = deletedSkus.slice(0, STALE_PURGE_SKU_SAMPLE_LIMIT)
  const suffix = deletedSkus.length > sample.length ? '…' : ''
  return `Удалено из каталога (нет в таблице): ${deletedSkus.length} — ${sample.join(', ')}${suffix}`
}

export const purgeProductsAbsentFromSheet = async (
  client: PoolClient,
  activeSkus: string[],
): Promise<{ deletedCount: number; deletedSkus: string[] }> => {
  if (!shouldPurgeStaleProducts(activeSkus)) {
    return { deletedCount: 0, deletedSkus: [] }
  }

  const result = await client.query<{ sku: string }>(
    `DELETE FROM products
     WHERE sku LIKE 'MU%'
       AND NOT (sku = ANY($1::text[]))
     RETURNING sku`,
    [activeSkus],
  )

  const deletedSkus = result.rows.map((row) => row.sku).sort()
  return { deletedCount: deletedSkus.length, deletedSkus }
}
