import type { CatalogProductListItem } from '../types/catalog'
import {
  applyPlaceholderToImageUrls,
  getCatalogPlaceholderImageUrl,
} from './catalog-placeholder.service'
import { pool } from '../utils/db'

export type CatalogProductRow = {
  id: number
  sku: string
  slug: string | null
  name: string
  price: string
  discount_percent: string
  in_stock: number
  is_gift_guide: boolean
  is_new_arrival: boolean
  new_arrival_at: Date | string | null
  image_url_1: string
  image_url_2: string
  image_urls: string[] | null
  category_name: string | null
  subcategory: string | null
  subcategory_slug: string | null
  web_subcategory_name: string | null
  web_subcategory_slug: string | null
  cross_category_name: string | null
  cross_category_slug: string | null
  cross_subcategory_name: string | null
  cross_subcategory_slug: string | null
  product_color: string | null
  dimensions_label: string | null
  color_tags: string[] | null
  weight_grams: number
  variant_color: string | null
  variant_size: string | null
}

const normalizeImageUrls = (
  imageUrls: string[] | null | undefined,
  imageUrl1: string | null | undefined,
  imageUrl2: string | null | undefined,
): string[] => {
  if (Array.isArray(imageUrls)) {
    return imageUrls.filter(Boolean)
  }
  return [imageUrl1, imageUrl2].filter((url): url is string => Boolean(url))
}

const mapSubcategorySlug = (raw: string | null | undefined): string | undefined => {
  const trimmed = raw?.trim()
  return trimmed || undefined
}

const mapWebPrimarySubcategory = (
  name: string | null | undefined,
  slug: string | null | undefined,
) => {
  const trimmedName = name?.trim()
  const trimmedSlug = slug?.trim()
  if (!trimmedName || !trimmedSlug) return undefined
  return { name: trimmedName, slug: trimmedSlug }
}

const mapWebCrossPlacement = (row: CatalogProductRow) => {
  const category = row.cross_category_name?.trim()
  const categorySlug = row.cross_category_slug?.trim()
  if (!category || !categorySlug) return undefined
  const placement = { category, categorySlug, subcategoryName: undefined as string | undefined, subcategorySlug: undefined as string | undefined }
  const subName = row.cross_subcategory_name?.trim()
  const subSlug = row.cross_subcategory_slug?.trim()
  if (subName) placement.subcategoryName = subName
  if (subSlug) placement.subcategorySlug = subSlug
  return placement
}

export const resolveWebSubcategoryName = (row: CatalogProductRow): string =>
  row.web_subcategory_name?.trim() || row.subcategory?.trim() || ''

export const resolveWebSubcategorySlug = (row: CatalogProductRow): string | undefined =>
  mapSubcategorySlug(row.web_subcategory_slug ?? row.subcategory_slug)

export const attachWebFields = (
  item: CatalogProductListItem,
  row: CatalogProductRow,
  web: boolean,
): void => {
  if (!web) return
  const primary = mapWebPrimarySubcategory(
    row.web_subcategory_name ?? row.subcategory,
    row.web_subcategory_slug ?? row.subcategory_slug,
  )
  if (primary) item.webPrimarySubcategory = primary
  const cross = mapWebCrossPlacement(row)
  if (cross) item.webCrossPlacement = cross
}

export const loadWebSubcategorySlugsByProductId = async (
  productIds: number[],
): Promise<Map<number, string[]>> => {
  const map = new Map<number, string[]>()
  if (productIds.length === 0) return map
  const result = await pool.query<{ product_id: number; slug: string }>(
    `SELECT ps.product_id, s.slug
     FROM product_subcategories ps
     JOIN subcategories s ON s.id = ps.subcategory_id
     WHERE ps.product_id = ANY($1::int[])
     ORDER BY ps.product_id, ps.position, s.slug`,
    [productIds],
  )
  for (const row of result.rows) {
    const list = map.get(row.product_id) ?? []
    list.push(row.slug)
    map.set(row.product_id, list)
  }
  return map
}

export const groupProductRowsToListItems = async (
  rows: CatalogProductRow[],
  web: boolean,
  placeholder?: string,
): Promise<CatalogProductListItem[]> => {
  const resolvedPlaceholder = placeholder ?? (await getCatalogPlaceholderImageUrl())
  const grouped = new Map<string, CatalogProductListItem>()
  const productIdBySku = new Map<string, number>()

  for (const row of rows) {
    if (!grouped.has(row.sku)) {
      productIdBySku.set(row.sku, row.id)
      const item: CatalogProductListItem = {
        sku: row.sku,
        slug: row.slug ?? '',
        name: row.name,
        price: Number(row.price),
        discountPercent: Number(row.discount_percent) || 0,
        inStock: row.in_stock,
        imageUrls: applyPlaceholderToImageUrls(
          normalizeImageUrls(row.image_urls, row.image_url_1, row.image_url_2),
          resolvedPlaceholder,
        ),
        colors: [],
        sizes: [],
        category: row.category_name ?? 'Без категории',
        subcategory: web ? resolveWebSubcategoryName(row) : '',
        giftGuide: row.is_gift_guide,
        newArrival: row.is_new_arrival,
        newArrivalAt:
          row.new_arrival_at instanceof Date
            ? row.new_arrival_at.toISOString()
            : row.new_arrival_at,
      }
      if (web) {
        const subSlug = resolveWebSubcategorySlug(row)
        if (subSlug) item.subcategorySlug = subSlug
      }
      if (row.product_color) {
        item.color = row.product_color
      }
      if (row.dimensions_label?.trim()) {
        item.dimensionsLabel = row.dimensions_label.trim()
      }
      if (row.color_tags?.length) {
        item.colorTags = row.color_tags
        item.colors = [...row.color_tags]
      } else if (row.product_color) {
        item.colors = [row.product_color]
      }
      attachWebFields(item, row, web)
      grouped.set(row.sku, item)
    }

    const product = grouped.get(row.sku)!
    if (
      row.variant_color &&
      !product.colors.includes(row.variant_color) &&
      !product.colorTags?.length
    ) {
      product.colors.push(row.variant_color)
    }
    if (row.variant_size && !product.sizes.includes(row.variant_size)) {
      product.sizes.push(row.variant_size)
    }
  }

  if (web && productIdBySku.size > 0) {
    const slugsById = await loadWebSubcategorySlugsByProductId([...productIdBySku.values()])
    for (const [sku, item] of grouped) {
      const id = productIdBySku.get(sku)
      if (id == null) continue
      const slugs = slugsById.get(id)
      if (slugs && slugs.length > 0) item.webSubcategorySlugs = slugs
    }
  }

  return Array.from(grouped.values())
}

export const pickFirstProductImageUrl = (
  row: Pick<CatalogProductRow, 'image_urls' | 'image_url_1' | 'image_url_2'>,
  placeholder: string,
): string | null => {
  const urls = applyPlaceholderToImageUrls(
    normalizeImageUrls(row.image_urls, row.image_url_1, row.image_url_2),
    placeholder,
  )
  return urls[0] ?? placeholder ?? null
}

export const isWebChannel = (channel?: string): boolean => channel === 'web'

export const buildWebSelectClause = (): string => `,
       p.subcategory,
       p.subcategory_slug,
       p.web_subcategory_name,
       p.web_subcategory_slug,
       c_cross.name AS cross_category_name,
       c_cross.slug AS cross_category_slug,
       pwcp.subcategory_name AS cross_subcategory_name,
       pwcp.subcategory_slug AS cross_subcategory_slug`

export const buildWebJoinClause = (): string => `
     LEFT JOIN product_web_cross_placements pwcp ON pwcp.product_id = p.id
     LEFT JOIN categories c_cross ON c_cross.id = pwcp.category_id`

export const buildProductSelectColumns = (web: boolean, extraSelect = ''): string => `
       p.id,
       p.sku,
       p.slug,
       p.name,
       p.price::text,
       p.discount_percent::text,
       p.in_stock,
       p.is_gift_guide,
       p.is_new_arrival,
       p.new_arrival_at,
       p.image_url_1,
       p.image_url_2,
       p.image_urls,
       c.name AS category_name,
       p.color AS product_color,
       p.dimensions_label,
       p.color_tags,
       p.weight_grams,
       v.color AS variant_color,
       v.size AS variant_size${web ? buildWebSelectClause() : ''}${extraSelect}`

export const buildProductFromClause = (web: boolean): string => `
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id${web ? buildWebJoinClause() : ''}
     LEFT JOIN variants v ON v.product_id = p.id`
