import { TOP_LEVEL_CATEGORIES } from '../constants/catalog-top-level'
import { buildProductTextSearchCondition } from './catalog-product-search'
import { pool } from '../utils/db'
import type { CatalogNode, CatalogProductDetail, CatalogProductListItem, Variant } from '../types/catalog'

const parseCategoryPath = (value: string) =>
  value
    .split('>')
    .map((item) => item.trim())
    .filter(Boolean)

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё-]/gi, '')

type ProductRow = {
  sku: string
  name: string
  price: string
  discount_percent: string
  in_stock: number
  image_url_1: string
  image_url_2: string
  image_urls: string[] | null
  category_name: string | null
  subcategory: string | null
  subcategory_slug: string | null
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
}

type SubcategoryAggRow = {
  category: string
  category_slug: string
  subcategory: string
  subcategory_slug: string
  cnt: number
}

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

const buildCatalogTree = (categoryPaths: string[]) => {
  const rootMap = new Map<string, CatalogNode>()
  TOP_LEVEL_CATEGORIES.forEach((name) => {
    rootMap.set(name, { name, slug: slugify(name), children: [] })
  })

  for (const rawPath of categoryPaths) {
    const parts = parseCategoryPath(rawPath)
    if (parts.length === 0) continue
    const [top, second, third] = parts
    const topNode = rootMap.get(top)
    if (!topNode) continue

    if (second && !topNode.children.some((child) => child.name === second)) {
      topNode.children.push({ name: second, slug: slugify(second), children: [] })
    }

    if (second && third) {
      const secondNode = topNode.children.find((child) => child.name === second)
      if (secondNode && !secondNode.children.some((child) => child.name === third)) {
        secondNode.children.push({ name: third, slug: slugify(third), children: [] })
      }
    }
  }

  return TOP_LEVEL_CATEGORIES.map((name) => rootMap.get(name)).filter(
    (item): item is CatalogNode => Boolean(item),
  )
}

const mergeCoverUrlsIntoTree = (nodes: CatalogNode[], coversBySlug: Map<string, string>) => {
  for (const node of nodes) {
    const url = coversBySlug.get(node.slug)
    if (url) node.coverImageUrl = url
    mergeCoverUrlsIntoTree(node.children, coversBySlug)
  }
}

const attachProductSubcategories = async (nodes: CatalogNode[]): Promise<void> => {
  const result = await pool.query<SubcategoryAggRow>(
    `SELECT c.name AS category, c.slug AS category_slug,
            p.subcategory, p.subcategory_slug, count(*)::int AS cnt
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.subcategory IS NOT NULL AND trim(p.subcategory) <> ''
     GROUP BY c.name, c.slug, p.subcategory, p.subcategory_slug`,
  )

  const byCategorySlug = new Map<string, SubcategoryAggRow[]>()
  for (const row of result.rows) {
    const list = byCategorySlug.get(row.category_slug) ?? []
    list.push(row)
    byCategorySlug.set(row.category_slug, list)
  }

  for (const node of nodes) {
    const rows = (byCategorySlug.get(node.slug) ?? []).sort((a, b) => b.cnt - a.cnt)
    node.children = rows.map((row) => ({
      name: row.subcategory,
      slug: row.subcategory_slug,
      children: [],
    }))
  }
}

export const getCatalogTree = async (withSubcategories = false): Promise<CatalogNode[]> => {
  const result = await pool.query<{ name: string }>('SELECT name FROM categories')
  const categoryNames = result.rows.map((row) => row.name)
  const fullTree = buildCatalogTree(categoryNames)

  const withProducts = await pool.query<{ slug: string }>(
    `SELECT DISTINCT c.slug
     FROM categories c
     INNER JOIN products p ON p.category_id = c.id`,
  )
  const slugsWithProducts = new Set(withProducts.rows.map((row) => row.slug))

  const filtered = fullTree.filter((node) => slugsWithProducts.has(node.slug))

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

export const getCatalogProducts = async (params: {
  category?: string
  categorySlug?: string
  subcategory?: string
  subcategorySlug?: string
  q?: string
  color?: string
  size?: string
  priceMax?: number
}) => {
  const { category, categorySlug, subcategory, subcategorySlug, q, color, size, priceMax } = params
  const conditions: string[] = []
  const values: Array<string | number> = []

  if (categorySlug) {
    values.push(categorySlug)
    conditions.push(`c.slug = $${values.length}`)
  } else if (category) {
    values.push(`%${category}%`)
    conditions.push(`c.name ILIKE $${values.length}`)
  }

  if (subcategorySlug) {
    values.push(subcategorySlug)
    conditions.push(`p.subcategory_slug = $${values.length}`)
  } else if (subcategory) {
    values.push(`%${subcategory}%`)
    conditions.push(`p.subcategory ILIKE $${values.length}`)
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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await pool.query<ProductRow>(
    `SELECT
       p.sku,
       p.name,
       p.price::text,
       p.discount_percent::text,
       p.in_stock,
       p.image_url_1,
       p.image_url_2,
       p.image_urls,
       c.name AS category_name,
       p.subcategory,
       p.subcategory_slug,
       p.color AS product_color,
       p.dimensions_label,
       p.color_tags,
       p.weight_grams,
       v.color AS variant_color,
       v.size AS variant_size
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN variants v ON v.product_id = p.id
     ${whereClause}
     ORDER BY p.updated_at DESC`,
    values,
  )

  const grouped = new Map<string, CatalogProductListItem>()
  for (const row of result.rows) {
    if (!grouped.has(row.sku)) {
      const item: CatalogProductListItem = {
        sku: row.sku,
        name: row.name,
        price: Number(row.price),
        discountPercent: Number(row.discount_percent) || 0,
        inStock: row.in_stock,
        imageUrls: normalizeImageUrls(row.image_urls, row.image_url_1, row.image_url_2),
        colors: [],
        sizes: [],
        category: row.category_name ?? 'Без категории',
        subcategory: row.subcategory?.trim() ?? '',
      }
      const subSlug = mapSubcategorySlug(row.subcategory_slug)
      if (subSlug) item.subcategorySlug = subSlug
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

  return Array.from(grouped.values())
}

export const getCatalogProductBySku = async (sku: string): Promise<CatalogProductDetail | null> => {
  const result = await pool.query<ProductDetailRow>(
    `SELECT
       p.sku,
       p.name,
       p.price::text,
       p.discount_percent::text,
       p.in_stock,
       p.image_url_1,
       p.image_url_2,
       p.image_urls,
       p.description,
       p.specs,
       c.name AS category_name,
       p.subcategory,
       p.subcategory_slug,
       p.color AS product_color,
       p.dimensions_label,
       p.color_tags,
       p.weight_grams,
       v.color AS variant_color,
       v.size AS variant_size
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN variants v ON v.product_id = p.id
     WHERE p.sku = $1`,
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
    name: first.name,
    price: Number(first.price),
    discountPercent: Number(first.discount_percent) || 0,
    inStock: first.in_stock,
    imageUrls: normalizeImageUrls(first.image_urls, first.image_url_1, first.image_url_2),
    colors: dotColors,
    sizes: Array.from(sizes),
    category: first.category_name ?? 'Без категории',
    subcategory: first.subcategory?.trim() ?? '',
    description: first.description ?? '',
    specs: first.specs ?? {},
    variants,
  }

  const subSlug = mapSubcategorySlug(first.subcategory_slug)
  if (subSlug) detail.subcategorySlug = subSlug
  if (first.product_color) detail.color = first.product_color
  if (first.dimensions_label?.trim()) detail.dimensionsLabel = first.dimensions_label.trim()
  if (first.color_tags?.length) detail.colorTags = first.color_tags
  detail.weightGrams = first.weight_grams

  return detail
}
