import { HttpError } from '../utils/api-response'
import { pool } from '../utils/db'

export type ProductCollectionsDto = {
  collectionIds: number[]
}

const normalizeSku = (sku: string): string => sku.trim().toUpperCase()

const assertProductExists = async (sku: string): Promise<void> => {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM products WHERE sku = $1) AS exists`,
    [sku],
  )
  if (!result.rows[0]?.exists) {
    throw new HttpError(404, `Unknown SKU: ${sku}`, 'NOT_FOUND')
  }
}

const fetchCollectionIdsForSku = async (sku: string): Promise<number[]> => {
  const result = await pool.query<{ collection_id: number }>(
    `SELECT collection_id
     FROM content_collection_products
     WHERE sku = $1
     ORDER BY collection_id ASC`,
    [sku],
  )
  return result.rows.map((row) => row.collection_id)
}

const dedupePositiveIds = (ids: number[]): number[] => {
  const seen = new Set<number>()
  const out: number[] = []
  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

const assertCollectionsExist = async (collectionIds: number[]): Promise<void> => {
  if (collectionIds.length === 0) return
  const result = await pool.query<{ id: number }>(
    `SELECT id FROM content_collections WHERE id = ANY($1::int[])`,
    [collectionIds],
  )
  const found = new Set(result.rows.map((row) => row.id))
  const missing = collectionIds.filter((id) => !found.has(id))
  if (missing.length > 0) {
    throw new HttpError(422, `Unknown collection id: ${missing.join(', ')}`, 'VALIDATION')
  }
}

export const getProductCollectionIds = async (skuRaw: string): Promise<ProductCollectionsDto> => {
  const sku = normalizeSku(skuRaw)
  if (!sku) {
    throw new HttpError(400, 'Invalid SKU', 'VALIDATION')
  }
  await assertProductExists(sku)
  return { collectionIds: await fetchCollectionIdsForSku(sku) }
}

export const setProductCollections = async (
  skuRaw: string,
  collectionIdsRaw: number[],
): Promise<ProductCollectionsDto> => {
  const sku = normalizeSku(skuRaw)
  if (!sku) {
    throw new HttpError(400, 'Invalid SKU', 'VALIDATION')
  }
  await assertProductExists(sku)

  const desired = dedupePositiveIds(collectionIdsRaw)
  await assertCollectionsExist(desired)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const currentResult = await client.query<{ collection_id: number }>(
      `SELECT collection_id FROM content_collection_products WHERE sku = $1`,
      [sku],
    )
    const current = new Set(currentResult.rows.map((row) => row.collection_id))

    if (desired.length === 0) {
      await client.query(`DELETE FROM content_collection_products WHERE sku = $1`, [sku])
    } else {
      await client.query(
        `DELETE FROM content_collection_products
         WHERE sku = $1 AND NOT (collection_id = ANY($2::int[]))`,
        [sku, desired],
      )
    }

    for (const collectionId of desired) {
      if (current.has(collectionId)) continue
      await client.query(
        `INSERT INTO content_collection_products (collection_id, sku, sort_order)
         VALUES (
           $1,
           $2,
           (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM content_collection_products WHERE collection_id = $1)
         )`,
        [collectionId, sku],
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return { collectionIds: await fetchCollectionIdsForSku(sku) }
}
