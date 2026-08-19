import type { CatalogProductListItem } from '../types/catalog'
import { pool } from '../utils/db'
import { getCatalogPlaceholderImageUrl } from './catalog-placeholder.service'
import {
  buildProductFromClause,
  buildProductSelectColumns,
  groupProductRowsToListItems,
  isWebChannel,
  pickFirstProductImageUrl,
  type CatalogProductRow,
} from './catalog-product-mapper'
import {
  buildProductTextSearchCondition,
  buildSearchRankExpression,
  isSearchQueryValid,
  normalizeSearchQuery,
  tokenizeSearchQuery,
} from './catalog-product-search'

export type CatalogSearchResult = {
  items: CatalogProductListItem[]
  total: number
  page: number
  pageSize: number
}

export type CatalogSearchSuggestProduct = {
  sku: string
  name: string
  slug: string
  price: number
  discountPercent: number
  imageUrl: string | null
}

export type CatalogSearchSuggestCategory = {
  name: string
  categorySlug: string
  subcategoryName?: string
  subcategorySlug?: string
}

export type CatalogSearchSuggestResult = {
  products: CatalogSearchSuggestProduct[]
  categories: CatalogSearchSuggestCategory[]
}

const clampPageSize = (pageSize: number): number => Math.min(100, Math.max(1, pageSize))

const buildSearchContext = (q: string, channel?: string) => {
  const web = isWebChannel(channel)
  const normalized = normalizeSearchQuery(q)
  const tokens = tokenizeSearchQuery(normalized)
  const filterValues: Array<string | number> = []
  const textSearch = buildProductTextSearchCondition(filterValues, normalized)
  const conditions = ['p.is_archived = FALSE']
  if (textSearch) conditions.push(textSearch)
  const rankValues = [...filterValues]
  const rankExpression = buildSearchRankExpression(rankValues, normalized, tokens)
  return {
    web,
    normalized,
    tokens,
    filterValues,
    rankValues,
    rankExpression,
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
  }
}

export const searchCatalogProducts = async (params: {
  q: string
  channel?: string
  page?: number
  pageSize?: number
}): Promise<CatalogSearchResult> => {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = clampPageSize(params.pageSize ?? 24)

  if (!isSearchQueryValid(params.q)) {
    return { items: [], total: 0, page, pageSize }
  }

  const ctx = buildSearchContext(params.q, params.channel)
  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(DISTINCT p.sku)::text AS total
     ${buildProductFromClause(ctx.web)}
     ${ctx.whereClause}`,
    ctx.filterValues,
  )
  const total = Number(countResult.rows[0]?.total ?? 0)
  if (total === 0) {
    return { items: [], total: 0, page, pageSize }
  }

  const rankedSkus = await pool.query<{ sku: string; search_rank: string }>(
    `SELECT DISTINCT ON (p.sku)
       p.sku,
       (${ctx.rankExpression}) AS search_rank
     ${buildProductFromClause(ctx.web)}
     ${ctx.whereClause}
     ORDER BY p.sku, search_rank DESC, p.updated_at DESC`,
    ctx.rankValues,
  )

  const offset = (page - 1) * pageSize
  const orderedSkus = [...rankedSkus.rows]
    .sort((a, b) => Number(b.search_rank) - Number(a.search_rank) || a.sku.localeCompare(b.sku))
    .slice(offset, offset + pageSize)
    .map((row) => row.sku)

  if (orderedSkus.length === 0) {
    return { items: [], total, page, pageSize }
  }

  const detailValues = [...ctx.rankValues, orderedSkus]
  const skuListIdx = detailValues.length
  const detailResult = await pool.query<CatalogProductRow>(
    `SELECT
       ${buildProductSelectColumns(ctx.web, `,\n       (${ctx.rankExpression}) AS search_rank`)}
     ${buildProductFromClause(ctx.web)}
     ${ctx.whereClause}
       AND p.sku = ANY($${skuListIdx}::text[])
     ORDER BY search_rank DESC, p.updated_at DESC, p.sku`,
    detailValues,
  )

  const items = await groupProductRowsToListItems(detailResult.rows, ctx.web)
  const rankBySku = new Map(rankedSkus.rows.map((row) => [row.sku, Number(row.search_rank)]))
  items.sort(
    (a, b) =>
      (rankBySku.get(b.sku) ?? 0) - (rankBySku.get(a.sku) ?? 0) ||
      a.sku.localeCompare(b.sku),
  )

  return { items, total, page, pageSize }
}

const buildCategoryMatchCondition = (
  values: Array<string | number>,
  tokens: string[],
): string | null => {
  if (tokens.length === 0) return null
  const tokenClauses = tokens.map((token) => {
    const patternIdx = values.push(`%${token}%`)
    return `(
      c.name ILIKE $${patternIdx}
      OR p.web_subcategory_name ILIKE $${patternIdx}
      OR p.subcategory ILIKE $${patternIdx}
    )`
  })
  return `(${tokenClauses.join(' AND ')})`
}

export const suggestCatalogSearch = async (params: {
  q: string
  channel?: string
  limitProducts?: number
  limitCategories?: number
}): Promise<CatalogSearchSuggestResult> => {
  const limitProducts = Math.max(1, params.limitProducts ?? 8)
  const limitCategories = Math.max(1, params.limitCategories ?? 3)

  if (!isSearchQueryValid(params.q)) {
    return { products: [], categories: [] }
  }

  const ctx = buildSearchContext(params.q, params.channel)
  const placeholder = await getCatalogPlaceholderImageUrl()

  const productValues = [...ctx.rankValues]
  const productLimitIdx = productValues.push(limitProducts)
  const productResult = await pool.query<CatalogProductRow>(
    `SELECT DISTINCT ON (p.sku)
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
       NULL::text AS variant_color,
       NULL::text AS variant_size
     ${buildProductFromClause(ctx.web)}
     ${ctx.whereClause}
     ORDER BY p.sku, (${ctx.rankExpression}) DESC, p.updated_at DESC
     LIMIT $${productLimitIdx}`,
    productValues,
  )

  const products: CatalogSearchSuggestProduct[] = productResult.rows
    .map((row) => ({
      sku: row.sku,
      name: row.name,
      slug: row.slug ?? '',
      price: Number(row.price),
      discountPercent: Number(row.discount_percent) || 0,
      imageUrl: pickFirstProductImageUrl(row, placeholder),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    .slice(0, limitProducts)

  const categoryValues: Array<string | number> = []
  const categoryMatch = buildCategoryMatchCondition(categoryValues, ctx.tokens)
  if (!categoryMatch) {
    return { products, categories: [] }
  }

  const categoryLimitIdx = categoryValues.push(limitCategories)
  const categoryResult = await pool.query<{
    category_name: string
    category_slug: string
    subcategory_name: string | null
    subcategory_slug: string | null
  }>(
    `SELECT DISTINCT
       c.name AS category_name,
       c.slug AS category_slug,
       COALESCE(NULLIF(trim(p.web_subcategory_name), ''), NULLIF(trim(p.subcategory), '')) AS subcategory_name,
       COALESCE(NULLIF(trim(p.web_subcategory_slug), ''), NULLIF(trim(p.subcategory_slug), '')) AS subcategory_slug
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.is_archived = FALSE
       AND ${categoryMatch}
     ORDER BY c.name, subcategory_name NULLS FIRST
     LIMIT $${categoryLimitIdx}`,
    categoryValues,
  )

  const categories: CatalogSearchSuggestCategory[] = categoryResult.rows.map((row) => {
    const item: CatalogSearchSuggestCategory = {
      name: row.category_name,
      categorySlug: row.category_slug,
    }
    if (row.subcategory_name) item.subcategoryName = row.subcategory_name
    if (row.subcategory_slug) item.subcategorySlug = row.subcategory_slug
    return item
  })

  return { products, categories }
}
