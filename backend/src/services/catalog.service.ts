import { SALE_CATEGORY_NAME, TOP_LEVEL_CATEGORIES } from '../constants/catalog-top-level'
import {
  categoryHasActiveProductsSql,
  productInCategoryByNameSql,
  productInCategoryBySlugSql,
} from './catalog-membership.helpers'
import {
  isSaleCategoryFilter,
  SALE_CATEGORY_SLUG,
} from './catalog-sale.helpers'
import { buildProductTextSearchCondition, buildSearchRankExpression, isSearchQueryValid, normalizeSearchQuery, tokenizeSearchQuery } from './catalog-product-search'
import {
  attachWebFields,
  buildProductFromClause,
  buildProductSelectColumns,
  groupProductRowsToListItems,
  isWebChannel,
  loadWebSubcategorySlugsByProductId,
  resolveWebSubcategoryName,
  resolveWebSubcategorySlug,
  type CatalogProductRow,
} from './catalog-product-mapper'
import { slugify } from './crm-catalog.helpers'
import {
  applyPlaceholderToImageUrls,
  getCatalogPlaceholderImageUrl,
} from './catalog-placeholder.service'
import { pool } from '../utils/db'
import type {
  CatalogNode,
  CatalogProductDetail,
  Variant,
} from '../types/catalog'

const parseCategoryPath = (value: string) =>
  value
    .split('>')
    .map((item) => item.trim())
    .filter(Boolean)

type ProductRow = {
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

type ProductDetailRow = ProductRow & {
  description: string
  specs: Record<string, string> | null
  seo_title: string
  seo_description: string
  seo_h1: string
}

type SubcategoryEntityRow = {
  category_slug: string
  name: string
  slug: string
  cover_image_url: string | null
  seo_title: string
  seo_description: string
  seo_h1: string
  seo_intro_top: string
  seo_text_bottom: string
}

const emptyCatalogSeo = () => ({
  seoTitle: '',
  seoDescription: '',
  seoH1: '',
  seoIntroTop: '',
  seoTextBottom: '',
})

const mapCatalogSeoFromRow = (row: {
  seo_title: string
  seo_description: string
  seo_h1: string
  seo_intro_top: string
  seo_text_bottom: string
}) => ({
  seoTitle: row.seo_title,
  seoDescription: row.seo_description,
  seoH1: row.seo_h1,
  seoIntroTop: row.seo_intro_top,
  seoTextBottom: row.seo_text_bottom,
})

const normalizeImageUrls = (
  imageUrls: string[] | null | undefined,
  imageUrl1: string | null | undefined,
  imageUrl2: string | null | undefined,
): string[] => {
  if (Array.isArray(imageUrls)) {
    // image_urls is the primary source: keep [] as-is for frontend placeholder fallback
    return imageUrls.filter(Boolean)
  }
  return [imageUrl1, imageUrl2].filter((url): url is string => Boolean(url))
}

const mapSubcategorySlug = (raw: string | null | undefined): string | undefined => {
  const trimmed = raw?.trim()
  return trimmed || undefined
}

const buildCatalogTree = (categories: Array<{ name: string; slug: string }>) => {
  const slugByName = new Map(categories.map((c) => [c.name, c.slug]))
  const rootMap = new Map<string, CatalogNode>()
  TOP_LEVEL_CATEGORIES.forEach((name) => {
    const slug = slugByName.get(name) ?? slugify(name)
    rootMap.set(name, { name, slug, children: [], ...emptyCatalogSeo() })
  })

  for (const { name: rawPath } of categories) {
    const parts = parseCategoryPath(rawPath)
    if (parts.length === 0) continue
    const [top, second, third] = parts
    const topNode = rootMap.get(top)
    if (!topNode) continue

    if (second && !topNode.children.some((child) => child.name === second)) {
      topNode.children.push({ name: second, slug: slugify(second), children: [], ...emptyCatalogSeo() })
    }

    if (second && third) {
      const secondNode = topNode.children.find((child) => child.name === second)
      if (secondNode && !secondNode.children.some((child) => child.name === third)) {
        secondNode.children.push({ name: third, slug: slugify(third), children: [], ...emptyCatalogSeo() })
      }
    }
  }

  return TOP_LEVEL_CATEGORIES.map((name) => rootMap.get(name)).filter(
    (item): item is CatalogNode => Boolean(item),
  )
}

const mergeSeoIntoTopNodes = (
  nodes: CatalogNode[],
  seoBySlug: Map<string, ReturnType<typeof mapCatalogSeoFromRow>>,
) => {
  for (const node of nodes) {
    const seo = seoBySlug.get(node.slug)
    if (seo) {
      node.seoTitle = seo.seoTitle
      node.seoDescription = seo.seoDescription
      node.seoH1 = seo.seoH1
      node.seoIntroTop = seo.seoIntroTop
      node.seoTextBottom = seo.seoTextBottom
    }
  }
}

const mergeCoverUrlsIntoTree = (nodes: CatalogNode[], coversBySlug: Map<string, string>) => {
  for (const node of nodes) {
    const url = coversBySlug.get(node.slug)
    if (url) node.coverImageUrl = url
    mergeCoverUrlsIntoTree(node.children, coversBySlug)
  }
}

const attachProductSubcategories = async (nodes: CatalogNode[]): Promise<void> => {
  const result = await pool.query<SubcategoryEntityRow>(
    `SELECT c.slug AS category_slug,
            s.name,
            s.slug,
            s.cover_image_url,
            s.seo_title,
            s.seo_description,
            s.seo_h1,
            s.seo_intro_top,
            s.seo_text_bottom
     FROM subcategories s
     JOIN categories c ON c.id = s.category_id
     WHERE EXISTS (
       SELECT 1
       FROM product_subcategories ps
       JOIN products p ON p.id = ps.product_id AND p.is_archived = FALSE
       WHERE ps.subcategory_id = s.id
     )
     ORDER BY c.slug, s.sort_order, s.name`,
  )

  const byCategorySlug = new Map<string, SubcategoryEntityRow[]>()
  for (const row of result.rows) {
    const list = byCategorySlug.get(row.category_slug) ?? []
    list.push(row)
    byCategorySlug.set(row.category_slug, list)
  }

  for (const node of nodes) {
    if (node.slug === SALE_CATEGORY_SLUG) {
      node.children = []
      continue
    }
    const rows = byCategorySlug.get(node.slug) ?? []
    node.children = rows.map((row) => ({
      name: row.name,
      slug: row.slug,
      coverImageUrl: row.cover_image_url ?? undefined,
      children: [],
      ...mapCatalogSeoFromRow(row),
    }))
  }
}

export const getCatalogTree = async (withSubcategories = false): Promise<CatalogNode[]> => {
  const result = await pool.query<{
    name: string
    slug: string
    seo_title: string
    seo_description: string
    seo_h1: string
    seo_intro_top: string
    seo_text_bottom: string
  }>(
    `SELECT name, slug, seo_title, seo_description, seo_h1, seo_intro_top, seo_text_bottom
     FROM categories`,
  )
  const seoBySlug = new Map(
    result.rows.map((row) => [row.slug, mapCatalogSeoFromRow(row)]),
  )
  const fullTree = buildCatalogTree(result.rows)
  mergeSeoIntoTopNodes(fullTree, seoBySlug)

  const withProducts = await pool.query<{ slug: string }>(
    `SELECT DISTINCT c.slug
     FROM categories c
     WHERE ${categoryHasActiveProductsSql('c')}`,
  )
  const slugsWithProducts = new Set(withProducts.rows.map((row) => row.slug))

  const saleExistsResult = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM products p
       WHERE p.is_archived = FALSE
         AND p.discount_percent > 0
     ) AS ok`,
  )
  const hasDiscounted = saleExistsResult.rows[0]?.ok === true

  const filtered = fullTree.filter((node) =>
    node.slug === SALE_CATEGORY_SLUG ? hasDiscounted : slugsWithProducts.has(node.slug),
  )

  const covers = await pool.query<{ slug: string; cover_image_url: string }>(
    `SELECT slug, cover_image_url FROM categories
     WHERE cover_image_url IS NOT NULL AND trim(cover_image_url) <> ''`,
  )
  const coverMap = new Map(covers.rows.map((row) => [row.slug, row.cover_image_url]))
  mergeCoverUrlsIntoTree(filtered, coverMap)

  if (withSubcategories) {
    await attachProductSubcategories(filtered)
  }

  return filtered
}

const productInSubcategoryBySlugSql = (productAlias: string, slugParam: string): string =>
  `EXISTS (
     SELECT 1
     FROM product_subcategories ps
     JOIN subcategories s ON s.id = ps.subcategory_id
     WHERE ps.product_id = ${productAlias}.id
       AND s.slug = ${slugParam}
   )`

const productInSubcategoryBySlugUnderCategorySql = (
  productAlias: string,
  categorySlugParam: string,
  subcategorySlugParam: string,
): string =>
  `EXISTS (
     SELECT 1
     FROM product_subcategories ps
     JOIN subcategories s ON s.id = ps.subcategory_id
     JOIN categories sc ON sc.id = s.category_id
     WHERE ps.product_id = ${productAlias}.id
       AND sc.slug = ${categorySlugParam}
       AND s.slug = ${subcategorySlugParam}
   )`

const productInSubcategoryByNameSql = (productAlias: string, nameParam: string): string =>
  `EXISTS (
     SELECT 1
     FROM product_subcategories ps
     JOIN subcategories s ON s.id = ps.subcategory_id
     WHERE ps.product_id = ${productAlias}.id
       AND s.name ILIKE ${nameParam}
   )`

const productInSubcategoryByNameUnderCategorySql = (
  productAlias: string,
  categoryNameParam: string,
  subcategoryNameParam: string,
): string =>
  `EXISTS (
     SELECT 1
     FROM product_subcategories ps
     JOIN subcategories s ON s.id = ps.subcategory_id
     JOIN categories sc ON sc.id = s.category_id
     WHERE ps.product_id = ${productAlias}.id
       AND sc.name ILIKE ${categoryNameParam}
       AND s.name ILIKE ${subcategoryNameParam}
   )`

export const getCatalogProducts = async (params: {
  channel?: string
  category?: string
  categorySlug?: string
  subcategory?: string
  subcategorySlug?: string
  q?: string
  color?: string
  size?: string
  priceMax?: number
  giftGuide?: boolean
  newArrival?: boolean
  sort?: string
}) => {
  const {
    channel,
    category,
    categorySlug,
    subcategory,
    subcategorySlug,
    q,
    color,
    size,
    priceMax,
    giftGuide,
    newArrival,
    sort,
  } = params

  if (q != null && q.trim() !== '' && !isSearchQueryValid(q)) {
    return []
  }

  const web = isWebChannel(channel)
  const conditions: string[] = ['p.is_archived = FALSE']
  const values: Array<string | number> = []

  if (isSaleCategoryFilter(category, categorySlug)) {
    conditions.push('p.discount_percent > 0')
  } else if (web) {
    if (categorySlug) {
      values.push(categorySlug)
      const catIdx = values.length
      if (subcategorySlug) {
        values.push(subcategorySlug)
        const subIdx = values.length
        conditions.push(
          `((c.slug = $${catIdx} AND p.web_subcategory_slug = $${subIdx}) OR (c_cross.slug = $${catIdx} AND pwcp.subcategory_slug = $${subIdx}) OR ${productInSubcategoryBySlugUnderCategorySql('p', `$${catIdx}`, `$${subIdx}`)})`,
        )
      } else {
        conditions.push(
          `(c.slug = $${catIdx} OR c_cross.slug = $${catIdx} OR ${productInCategoryBySlugSql('p', `$${catIdx}`)})`,
        )
      }
    } else if (category) {
      values.push(`%${category}%`)
      const catIdx = values.length
      if (subcategory) {
        values.push(`%${subcategory}%`)
        const subIdx = values.length
        conditions.push(
          `((c.name ILIKE $${catIdx} AND p.web_subcategory_name ILIKE $${subIdx}) OR (c_cross.name ILIKE $${catIdx} AND pwcp.subcategory_name ILIKE $${subIdx}) OR (${productInCategoryByNameSql('p', `$${catIdx}`)} AND p.web_subcategory_name ILIKE $${subIdx}) OR ${productInSubcategoryByNameUnderCategorySql('p', `$${catIdx}`, `$${subIdx}`)})`,
        )
      } else {
        conditions.push(
          `(c.name ILIKE $${catIdx} OR c_cross.name ILIKE $${catIdx} OR ${productInCategoryByNameSql('p', `$${catIdx}`)})`,
        )
      }
    } else if (subcategorySlug) {
      values.push(subcategorySlug)
      conditions.push(
        `(p.web_subcategory_slug = $${values.length} OR pwcp.subcategory_slug = $${values.length} OR ${productInSubcategoryBySlugSql('p', `$${values.length}`)})`,
      )
    } else if (subcategory) {
      values.push(`%${subcategory}%`)
      conditions.push(
        `(p.web_subcategory_name ILIKE $${values.length} OR pwcp.subcategory_name ILIKE $${values.length} OR ${productInSubcategoryByNameSql('p', `$${values.length}`)})`,
      )
    }
  } else {
    if (categorySlug) {
      values.push(categorySlug)
      conditions.push(
        `(c.slug = $${values.length} OR ${productInCategoryBySlugSql('p', `$${values.length}`)})`,
      )
    } else if (category) {
      values.push(`%${category}%`)
      conditions.push(
        `(c.name ILIKE $${values.length} OR ${productInCategoryByNameSql('p', `$${values.length}`)})`,
      )
    }
  }

  if (q) {
    const textSearch = buildProductTextSearchCondition(values, q)
    if (textSearch) conditions.push(textSearch)
  }
  if (color) {
    values.push(`%${color}%`)
    const likeIdx = values.length
    values.push(color.toLowerCase().trim())
    const tagIdx = values.length
    conditions.push(
      `(v.color ILIKE $${likeIdx} OR p.color ILIKE $${likeIdx} OR EXISTS (SELECT 1 FROM unnest(p.color_tags) AS t(tag) WHERE tag ILIKE $${likeIdx}) OR $${tagIdx} = ANY(p.color_tags))`,
    )
  }
  if (size) {
    values.push(`%${size}%`)
    conditions.push(`v.size ILIKE $${values.length}`)
  }
  if (typeof priceMax === 'number' && Number.isFinite(priceMax)) {
    values.push(priceMax)
    conditions.push(`p.price <= $${values.length}`)
  }
  if (giftGuide === true) {
    conditions.push('p.is_gift_guide = TRUE')
  }

  if (newArrival === true) {
    conditions.push('p.is_new_arrival = TRUE')
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const hasSearch = Boolean(q && isSearchQueryValid(q))
  let searchRankSelect = ''
  if (hasSearch) {
    const normalized = normalizeSearchQuery(q!)
    const tokens = tokenizeSearchQuery(normalized)
    searchRankSelect = `, (${buildSearchRankExpression(values, normalized, tokens)}) AS search_rank`
  }
  const orderBy = hasSearch
    ? sort === 'new'
      ? 'ORDER BY p.new_arrival_at DESC NULLS LAST, search_rank DESC, p.updated_at DESC'
      : 'ORDER BY search_rank DESC, p.updated_at DESC'
    : sort === 'new'
      ? 'ORDER BY p.new_arrival_at DESC NULLS LAST, p.updated_at DESC'
      : 'ORDER BY p.updated_at DESC'

  const result = await pool.query<CatalogProductRow>(
    `SELECT
       ${buildProductSelectColumns(web, searchRankSelect)}
     ${buildProductFromClause(web)}
     ${whereClause}
     ${orderBy}`,
    values,
  )

  return groupProductRowsToListItems(result.rows, web)
}

export const getCatalogProductBySku = async (
  sku: string,
  channel?: string,
): Promise<CatalogProductDetail | null> => {
  const web = isWebChannel(channel)
  const webSelect = web
    ? `,
       p.subcategory,
       p.subcategory_slug,
       p.web_subcategory_name,
       p.web_subcategory_slug,
       c_cross.name AS cross_category_name,
       c_cross.slug AS cross_category_slug,
       pwcp.subcategory_name AS cross_subcategory_name,
       pwcp.subcategory_slug AS cross_subcategory_slug`
    : ''
  const webJoins = web
    ? `
     LEFT JOIN product_web_cross_placements pwcp ON pwcp.product_id = p.id
     LEFT JOIN categories c_cross ON c_cross.id = pwcp.category_id`
    : ''

  const result = await pool.query<ProductDetailRow>(
    `SELECT
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
       p.description,
       p.specs,
       c.name AS category_name,
       p.color AS product_color,
       p.dimensions_label,
       p.color_tags,
       p.weight_grams,
       p.seo_title,
       p.seo_description,
       p.seo_h1,
       v.color AS variant_color,
       v.size AS variant_size${webSelect}
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id${webJoins}
     LEFT JOIN variants v ON v.product_id = p.id
     WHERE p.sku = $1 AND p.is_archived = FALSE`,
    [sku],
  )

  if (result.rows.length === 0) return null
  const first = result.rows[0]

  const variantSet = new Set<string>()
  const variants: Variant[] = []
  const colors = new Set<string>()
  const sizes = new Set<string>()

  for (const row of result.rows) {
    if (row.variant_color) colors.add(row.variant_color)
    if (row.variant_size) sizes.add(row.variant_size)
    const key = `${row.variant_color ?? ''}|${row.variant_size ?? ''}`
    if (!variantSet.has(key) && (row.variant_color || row.variant_size)) {
      variantSet.add(key)
      variants.push({
        color: row.variant_color ?? undefined,
        size: row.variant_size ?? undefined,
      })
    }
  }

  if (first.product_color) colors.add(first.product_color)

  const dotColors =
    first.color_tags && first.color_tags.length > 0
      ? [...first.color_tags]
      : Array.from(colors)

  const detail: CatalogProductDetail = {
    sku: first.sku,
    slug: first.slug ?? '',
    name: first.name,
    price: Number(first.price),
    discountPercent: Number(first.discount_percent) || 0,
    inStock: first.in_stock,
    imageUrls: applyPlaceholderToImageUrls(
      normalizeImageUrls(first.image_urls, first.image_url_1, first.image_url_2),
      await getCatalogPlaceholderImageUrl(),
    ),
    colors: dotColors,
    sizes: Array.from(sizes),
    category: first.category_name ?? 'Без категории',
    subcategory: web ? resolveWebSubcategoryName(first) : '',
    giftGuide: first.is_gift_guide,
    newArrival: first.is_new_arrival,
    newArrivalAt:
      first.new_arrival_at instanceof Date
        ? first.new_arrival_at.toISOString()
        : first.new_arrival_at,
    description: first.description ?? '',
    specs: first.specs ?? {},
    variants,
    seoTitle: first.seo_title,
    seoDescription: first.seo_description,
    seoH1: first.seo_h1,
  }

  if (web) {
    const subSlug = resolveWebSubcategorySlug(first)
    if (subSlug) detail.subcategorySlug = subSlug
  }
  if (first.product_color) detail.color = first.product_color
  if (first.dimensions_label?.trim()) detail.dimensionsLabel = first.dimensions_label.trim()
  if (first.color_tags?.length) detail.colorTags = first.color_tags
  detail.weightGrams = first.weight_grams
  attachWebFields(detail, first, web)

  if (web) {
    const slugsById = await loadWebSubcategorySlugsByProductId([first.id])
    const slugs = slugsById.get(first.id)
    if (slugs && slugs.length > 0) detail.webSubcategorySlugs = slugs
  }

  return detail
}

export const getCatalogProductBySlug = async (
  slugRaw: string,
  channel?: string,
): Promise<CatalogProductDetail | null> => {
  const slug = slugRaw.trim().toLowerCase()
  if (!slug) return null
  const found = await pool.query<{ sku: string }>(
    `SELECT sku FROM products WHERE slug = $1 AND is_archived = FALSE LIMIT 1`,
    [slug],
  )
  const sku = found.rows[0]?.sku
  if (!sku) return null
  return getCatalogProductBySku(sku, channel)
}
