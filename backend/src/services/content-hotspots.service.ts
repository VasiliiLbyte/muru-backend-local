import type { HotspotPatchInput, HotspotWriteInput } from '../schemas/content.schemas'
import type { CrmLookbookHotspotDto, LookbookHotspotDto } from '../types/content'
import { HttpError } from '../utils/api-response'
import { pool } from '../utils/db'

type HotspotRow = {
  id: number
  lookbook_id: number
  product_id: number
  x_percent: string
  y_percent: string
  sort_order: number
  created_at: Date | string
  updated_at: Date | string
}

type PublicHotspotRow = HotspotRow & {
  sku: string
  name: string
  price: string
  discount_percent: string
  image_url_1: string | null
  image_urls: string[] | null
  category_slug: string | null
  web_subcategory_slug: string | null
  subcategory_slug: string | null
}

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value

const mapCrmRow = (row: HotspotRow): CrmLookbookHotspotDto => ({
  id: String(row.id),
  lookbookId: String(row.lookbook_id),
  productId: row.product_id,
  xPercent: Number(row.x_percent),
  yPercent: Number(row.y_percent),
  sortOrder: row.sort_order,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
})

const pickPrimaryImage = (imageUrl1: string | null, imageUrls: string[] | null): string | undefined => {
  const first = imageUrl1?.trim()
  if (first) return first
  if (Array.isArray(imageUrls)) {
    const fromArray = imageUrls.map((url) => url?.trim()).find(Boolean)
    if (fromArray) return fromArray
  }
  return undefined
}

export const buildProductCatalogPath = (input: {
  sku: string
  categorySlug: string | null
  webSubcategorySlug: string | null
  subcategorySlug: string | null
}): string => {
  const topSlug = input.categorySlug?.trim() || 'bez-kategorii'
  const leafSlug =
    input.webSubcategorySlug?.trim() ||
    input.subcategorySlug?.trim() ||
    topSlug
  return `/catalog/${topSlug}/${leafSlug}/${input.sku}/`
}

const mapPublicRow = (row: PublicHotspotRow): LookbookHotspotDto => {
  const price = Number(row.price)
  const discountPercent = Number(row.discount_percent) || 0
  const image = pickPrimaryImage(row.image_url_1, row.image_urls)

  const product: LookbookHotspotDto['product'] = {
    sku: row.sku,
    name: row.name,
    price,
    slug: buildProductCatalogPath({
      sku: row.sku,
      categorySlug: row.category_slug,
      webSubcategorySlug: row.web_subcategory_slug,
      subcategorySlug: row.subcategory_slug,
    }),
  }

  if (discountPercent > 0) {
    product.salePrice = price
  }
  if (image) {
    product.image = image
  }

  return {
    id: String(row.id),
    xPercent: Number(row.x_percent),
    yPercent: Number(row.y_percent),
    sortOrder: row.sort_order,
    product,
  }
}

const assertLookbookExists = async (lookbookId: number): Promise<void> => {
  const result = await pool.query<{ id: number }>(
    `SELECT id FROM content_lookbooks WHERE id = $1`,
    [lookbookId],
  )
  if (result.rows.length === 0) {
    throw new HttpError(404, 'Lookbook not found', 'NOT_FOUND')
  }
}

const assertActiveProductExists = async (productId: number): Promise<void> => {
  const result = await pool.query<{ id: number }>(
    `SELECT id FROM products WHERE id = $1 AND is_archived = FALSE`,
    [productId],
  )
  if (result.rows.length === 0) {
    throw new HttpError(404, 'Product not found or archived', 'NOT_FOUND')
  }
}

export const listCrmLookbookHotspots = async (
  lookbookId: number,
): Promise<CrmLookbookHotspotDto[]> => {
  await assertLookbookExists(lookbookId)

  const result = await pool.query<HotspotRow>(
    `SELECT id, lookbook_id, product_id, x_percent, y_percent, sort_order, created_at, updated_at
     FROM content_lookbook_hotspots
     WHERE lookbook_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [lookbookId],
  )

  return result.rows.map(mapCrmRow)
}

export const createLookbookHotspot = async (
  lookbookId: number,
  input: HotspotWriteInput,
): Promise<CrmLookbookHotspotDto> => {
  await assertLookbookExists(lookbookId)
  await assertActiveProductExists(input.productId)

  const result = await pool.query<HotspotRow>(
    `INSERT INTO content_lookbook_hotspots
       (lookbook_id, product_id, x_percent, y_percent, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, lookbook_id, product_id, x_percent, y_percent, sort_order, created_at, updated_at`,
    [lookbookId, input.productId, input.xPercent, input.yPercent, input.sortOrder ?? 0],
  )

  return mapCrmRow(result.rows[0])
}

export const updateLookbookHotspot = async (
  lookbookId: number,
  hotspotId: number,
  input: HotspotPatchInput,
): Promise<CrmLookbookHotspotDto> => {
  await assertLookbookExists(lookbookId)

  const sets: string[] = ['updated_at = NOW()']
  const params: unknown[] = []

  if (input.productId !== undefined) {
    await assertActiveProductExists(input.productId)
    params.push(input.productId)
    sets.push(`product_id = $${params.length}`)
  }
  if (input.xPercent !== undefined) {
    params.push(input.xPercent)
    sets.push(`x_percent = $${params.length}`)
  }
  if (input.yPercent !== undefined) {
    params.push(input.yPercent)
    sets.push(`y_percent = $${params.length}`)
  }
  if (input.sortOrder !== undefined) {
    params.push(input.sortOrder)
    sets.push(`sort_order = $${params.length}`)
  }

  params.push(hotspotId, lookbookId)

  const result = await pool.query<HotspotRow>(
    `UPDATE content_lookbook_hotspots
     SET ${sets.join(', ')}
     WHERE id = $${params.length - 1} AND lookbook_id = $${params.length}
     RETURNING id, lookbook_id, product_id, x_percent, y_percent, sort_order, created_at, updated_at`,
    params,
  )

  if (result.rows.length === 0) {
    throw new HttpError(404, 'Hotspot not found', 'NOT_FOUND')
  }

  return mapCrmRow(result.rows[0])
}

export const deleteLookbookHotspot = async (
  lookbookId: number,
  hotspotId: number,
): Promise<void> => {
  await assertLookbookExists(lookbookId)

  const result = await pool.query(
    `DELETE FROM content_lookbook_hotspots WHERE id = $1 AND lookbook_id = $2`,
    [hotspotId, lookbookId],
  )

  if ((result.rowCount ?? 0) === 0) {
    throw new HttpError(404, 'Hotspot not found', 'NOT_FOUND')
  }
}

export const listPublicHotspotsForLookbook = async (
  lookbookId: number,
): Promise<LookbookHotspotDto[]> => {
  const result = await pool.query<PublicHotspotRow>(
    `SELECT h.id, h.lookbook_id, h.product_id, h.x_percent, h.y_percent, h.sort_order,
            h.created_at, h.updated_at,
            p.sku, p.name, p.price::text, p.discount_percent::text,
            p.image_url_1, p.image_urls,
            c.slug AS category_slug,
            p.web_subcategory_slug, p.subcategory_slug
     FROM content_lookbook_hotspots h
     INNER JOIN products p ON p.id = h.product_id AND p.is_archived = FALSE
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE h.lookbook_id = $1
     ORDER BY h.sort_order ASC, h.id ASC`,
    [lookbookId],
  )

  return result.rows.map(mapPublicRow)
}
