import { pool } from '../utils/db'
import type { CatalogNode, CatalogProductDetail, CatalogProductListItem, Variant } from '../types/catalog'

const TOP_LEVEL_CATEGORIES = [
  'Флористика',
  'Натуральный декор',
  'Вазы и аксессуары',
  'Текстиль',
  'Кухня и столовая',
  'Интерьер',
  'Распродажа',
  'Комплексные наборы',
]

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
  in_stock: number
  image_url_1: string
  image_url_2: string
  image_urls: string[] | null
  category_name: string | null
  color: string | null
  size: string | null
}

type ProductDetailRow = {
  sku: string
  name: string
  price: string
  in_stock: number
  image_url_1: string
  image_url_2: string
  image_urls: string[] | null
  category_name: string | null
  description: string
  specs: Record<string, string> | null
  color: string | null
  size: string | null
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

export const getCatalogTree = async (): Promise<CatalogNode[]> => {
  const result = await pool.query<{ name: string }>('SELECT name FROM categories')
  const categoryNames = result.rows.map((row) => row.name)
  return buildCatalogTree(categoryNames)
}

export const getCatalogProducts = async (params: {
  category?: string
  subcategory?: string
  q?: string
  color?: string
  size?: string
  priceMax?: number
}) => {
  const { category, subcategory, q, color, size, priceMax } = params
  const conditions: string[] = []
  const values: Array<string | number> = []

  if (category) {
    values.push(`%${category}%`)
    conditions.push(`c.name ILIKE $${values.length}`)
  }
  if (subcategory) {
    values.push(`%${subcategory}%`)
    conditions.push(`c.name ILIKE $${values.length}`)
  }
  if (q) {
    values.push(`%${q}%`)
    const idx = values.length
    conditions.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`)
  }
  if (color) {
    values.push(`%${color}%`)
    conditions.push(`v.color ILIKE $${values.length}`)
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
       p.in_stock,
       p.image_url_1,
       p.image_url_2,
       p.image_urls,
       c.name AS category_name,
       v.color,
       v.size
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN variants v ON v.product_id = p.id
     ${whereClause}
     ORDER BY p.updated_at DESC`,
    values,
  )

  const grouped = new Map<string, CatalogProductListItem>()
  for (const row of result.rows) {
    const categoryPath = row.category_name ?? 'Без категории'
    const pathParts = parseCategoryPath(categoryPath)
    const categoryName = pathParts[0] ?? categoryPath
    const subcategoryName = pathParts[1] ?? 'Общее'

    if (!grouped.has(row.sku)) {
      grouped.set(row.sku, {
        sku: row.sku,
        name: row.name,
        price: Number(row.price),
        inStock: row.in_stock,
        imageUrls: normalizeImageUrls(row.image_urls, row.image_url_1, row.image_url_2),
        colors: [],
        sizes: [],
        category: categoryName,
        subcategory: subcategoryName,
      })
    }

    const product = grouped.get(row.sku)!
    if (row.color && !product.colors.includes(row.color)) product.colors.push(row.color)
    if (row.size && !product.sizes.includes(row.size)) product.sizes.push(row.size)
  }

  return Array.from(grouped.values())
}

export const getCatalogProductBySku = async (sku: string): Promise<CatalogProductDetail | null> => {
  const result = await pool.query<ProductDetailRow>(
    `SELECT
       p.sku,
       p.name,
       p.price::text,
       p.in_stock,
       p.image_url_1,
       p.image_url_2,
       p.image_urls,
       p.description,
       p.specs,
       c.name AS category_name,
       v.color,
       v.size
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN variants v ON v.product_id = p.id
     WHERE p.sku = $1`,
    [sku],
  )

  if (result.rows.length === 0) return null
  const first = result.rows[0]
  const categoryPath = first.category_name ?? 'Без категории'
  const [category = categoryPath, subcategory = 'Общее'] = parseCategoryPath(categoryPath)

  const variantSet = new Set<string>()
  const variants: Variant[] = []
  const colors = new Set<string>()
  const sizes = new Set<string>()

  for (const row of result.rows) {
    if (row.color) colors.add(row.color)
    if (row.size) sizes.add(row.size)
    const key = `${row.color ?? ''}|${row.size ?? ''}`
    if (!variantSet.has(key) && (row.color || row.size)) {
      variantSet.add(key)
      variants.push({ color: row.color ?? undefined, size: row.size ?? undefined })
    }
  }

  return {
    sku: first.sku,
    name: first.name,
    price: Number(first.price),
    inStock: first.in_stock,
    imageUrls: normalizeImageUrls(first.image_urls, first.image_url_1, first.image_url_2),
    colors: Array.from(colors),
    sizes: Array.from(sizes),
    category,
    subcategory,
    description: first.description ?? '',
    specs: first.specs ?? {},
    variants,
  }
}
