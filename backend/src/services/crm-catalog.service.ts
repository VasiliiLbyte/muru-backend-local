import {
  PRODUCT_DEFAULT_DIM_HEIGHT_CM,
  PRODUCT_DEFAULT_DIM_LENGTH_CM,
  PRODUCT_DEFAULT_DIM_WIDTH_CM,
  PRODUCT_DEFAULT_WEIGHT_GRAMS,
} from '../constants/product-shipping-defaults'
import { SALE_CATEGORY_NAME } from '../constants/catalog-top-level'
import type {
  CreateCrmCatalogProductInput,
  PatchCrmCatalogProductInput,
} from '../schemas/crm-catalog.schemas'
import { extractDimsInput, hasDimsInput } from '../schemas/crm-catalog.schemas'
import { pool } from '../utils/db'
import { env } from '../utils/env'

import { normalizeAdminOrdersPage, normalizeAdminOrdersPageSize } from './admin-orders.helpers'
import {
  isSaleCategoryFilter,
  SALE_VIRTUAL_PRODUCT_WHERE,
} from './catalog-sale.helpers'
import { assertCatalogCrmWritable } from './catalog-source.guard'
import {
  getSubcategoryDenormById,
  validateSubcategoryIdsExist,
} from './crm-catalog-subcategories.service'
import { conflictError, slugify } from './crm-catalog.helpers'
import { validateProductDimsUpdate } from './admin-product-dims.validation'

const DEFAULT_IMAGE_URL = 'https://placehold.co/1200x1200?text=MURU'

export type CrmCatalogMeta = {
  catalogSource: 'sheets' | 'crm'
  readOnly: boolean
}

export type CrmCatalogListItem = {
  id: number
  sku: string
  name: string
  price: number
  discountPercent: number
  inStock: number
  isArchived: boolean
  isGiftGuide: boolean
  categoryName: string | null
  webSubcategoryName: string | null
  imageUrl: string | null
}

export type CrmCatalogProductDetail = {
  id: number
  sku: string
  name: string
  description: string
  price: number
  discountPercent: number
  inStock: number
  isArchived: boolean
  isGiftGuide: boolean
  specs: Record<string, string>
  imageUrls: string[]
  imageUrl1: string
  imageUrl2: string
  categoryId: number | null
  categoryName: string | null
  webSubcategoryName: string | null
  webSubcategorySlug: string | null
  subcategory: string | null
  subcategorySlug: string | null
  subcategoryIds: number[]
  color: string | null
  size: string | null
  colorTags: string[]
  dimensionsLabel: string
  weightGrams: number
  dimLengthCm: number
  dimWidthCm: number
  dimHeightCm: number
  dimsSource: 'auto' | 'manual'
  weightSource: 'auto' | 'manual'
  updatedAt: string
}

export type CrmCatalogSortBy = 'sku' | 'price' | 'inStock' | 'updatedAt'
export type CrmCatalogSortDir = 'asc' | 'desc'

export type CrmCatalogListFilters = {
  q?: string
  category?: string
  subcategory?: string
  inStock?: 'in' | 'out' | 'all'
  archived?: 'true' | 'false' | 'all'
  giftGuide?: 'true' | 'false' | 'all'
  page?: unknown
  pageSize?: unknown
  sortBy?: CrmCatalogSortBy
  sortDir?: CrmCatalogSortDir
}

export type CrmCatalogListResult = {
  items: CrmCatalogListItem[]
  total: number
  page: number
  pageSize: number
  catalogSource: 'sheets' | 'crm'
  readOnly: boolean
}

type ProductRow = {
  id: number
  sku: string
  name: string
  description: string
  price: string
  discount_percent: string
  in_stock: number
  is_archived: boolean
  is_gift_guide: boolean
  specs: Record<string, string> | null
  image_url_1: string
  image_url_2: string
  image_urls: string[] | null
  category_id: number | null
  category_name: string | null
  web_subcategory_name: string | null
  web_subcategory_slug: string | null
  subcategory: string | null
  subcategory_slug: string | null
  color: string | null
  size: string | null
  color_tags: string[] | null
  dimensions_label: string
  weight_grams: number
  dim_length_cm: number
  dim_width_cm: number
  dim_height_cm: number
  dims_source: 'auto' | 'manual'
  weight_source: 'auto' | 'manual'
  updated_at: string
}

const listMeta = () => ({
  catalogSource: env.catalogSource,
  readOnly: env.catalogSource !== 'crm',
})

const pickImageUrl = (row: Pick<ProductRow, 'image_urls' | 'image_url_1'>): string | null => {
  if (Array.isArray(row.image_urls) && typeof row.image_urls[0] === 'string') {
    return row.image_urls[0]
  }
  return row.image_url_1?.trim() || null
}

const normalizeImageUrls = (
  imageUrls: string[] | undefined,
  imageUrl1: string | undefined,
  imageUrl2: string | undefined,
): { imageUrl1: string; imageUrl2: string; imageUrls: string[] } => {
  const urls = imageUrls?.filter(Boolean) ?? []
  const first = urls[0] ?? imageUrl1?.trim() ?? DEFAULT_IMAGE_URL
  const second = urls[1] ?? imageUrl2?.trim() ?? first
  const normalized = urls.length > 0 ? urls.slice(0, 3) : [first]
  return { imageUrl1: first, imageUrl2: second, imageUrls: normalized }
}

const mapListRow = (row: ProductRow): CrmCatalogListItem => ({
  id: row.id,
  sku: row.sku,
  name: row.name,
  price: Number(row.price),
  discountPercent: Number(row.discount_percent) || 0,
  inStock: row.in_stock,
  isArchived: row.is_archived,
  isGiftGuide: row.is_gift_guide,
  categoryName: row.category_name,
  webSubcategoryName: row.web_subcategory_name,
  imageUrl: pickImageUrl(row),
})

const mapDetailRow = (row: ProductRow): CrmCatalogProductDetail => ({
  id: row.id,
  sku: row.sku,
  name: row.name,
  description: row.description,
  price: Number(row.price),
  discountPercent: Number(row.discount_percent) || 0,
  inStock: row.in_stock,
  isArchived: row.is_archived,
  isGiftGuide: row.is_gift_guide,
  specs: row.specs ?? {},
  imageUrls: Array.isArray(row.image_urls)
    ? row.image_urls.filter(Boolean)
    : [row.image_url_1, row.image_url_2].filter(Boolean),
  imageUrl1: row.image_url_1,
  imageUrl2: row.image_url_2,
  categoryId: row.category_id,
  categoryName: row.category_name,
  webSubcategoryName: row.web_subcategory_name,
  webSubcategorySlug: row.web_subcategory_slug,
  subcategory: row.subcategory,
  subcategorySlug: row.subcategory_slug,
  subcategoryIds: [],
  color: row.color,
  size: row.size,
  colorTags: row.color_tags ?? [],
  dimensionsLabel: row.dimensions_label,
  weightGrams: row.weight_grams,
  dimLengthCm: row.dim_length_cm,
  dimWidthCm: row.dim_width_cm,
  dimHeightCm: row.dim_height_cm,
  dimsSource: row.dims_source,
  weightSource: row.weight_source,
  updatedAt: row.updated_at,
})

const PRODUCT_SELECT = `
  p.id,
  p.sku,
  p.name,
  p.description,
  p.price::text,
  p.discount_percent::text,
  p.in_stock,
  p.is_archived,
  p.is_gift_guide,
  p.specs,
  p.image_url_1,
  p.image_url_2,
  p.image_urls,
  p.category_id,
  c.name AS category_name,
  p.web_subcategory_name,
  p.web_subcategory_slug,
  p.subcategory,
  p.subcategory_slug,
  p.color,
  p.size,
  p.color_tags,
  p.dimensions_label,
  p.weight_grams,
  p.dim_length_cm,
  p.dim_width_cm,
  p.dim_height_cm,
  p.dims_source,
  p.weight_source,
  p.updated_at::text
`

const FROM_PRODUCT = `
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`

type FilterBuildResult = { where: string[]; params: unknown[] }

const buildListFilters = (filters: CrmCatalogListFilters): FilterBuildResult => {
  const where: string[] = []
  const params: unknown[] = []

  const category = filters.category?.trim()
  const isSaleFilter = Boolean(category && isSaleCategoryFilter(category, category))

  if (isSaleFilter) {
    where.push(SALE_VIRTUAL_PRODUCT_WHERE)
  } else {
    const archived = filters.archived ?? 'false'
    if (archived === 'true') {
      where.push('p.is_archived = TRUE')
    } else if (archived === 'false') {
      where.push('p.is_archived = FALSE')
    }

    if (category) {
      params.push(category)
      const idx = params.length
      where.push(`(c.slug = $${idx} OR c.name ILIKE $${idx})`)
    }

    const subcategory = filters.subcategory?.trim()
    if (subcategory) {
      params.push(subcategory)
      const idx = params.length
      params.push(`%${subcategory}%`)
      const likeIdx = params.length
      where.push(
        `(p.web_subcategory_slug = $${idx} OR p.web_subcategory_name ILIKE $${likeIdx} OR p.subcategory_slug = $${idx} OR p.subcategory ILIKE $${likeIdx})`,
      )
    }
  }

  const giftGuide = filters.giftGuide ?? 'all'
  if (giftGuide === 'true') {
    where.push('p.is_gift_guide = TRUE')
  } else if (giftGuide === 'false') {
    where.push('p.is_gift_guide = FALSE')
  }

  const inStock = filters.inStock ?? 'all'
  if (inStock === 'in') {
    where.push('p.in_stock > 0')
  } else if (inStock === 'out') {
    where.push('p.in_stock = 0')
  }

  const q = filters.q?.trim()
  if (q) {
    params.push(`%${q}%`)
    const idx = params.length
    where.push(`(p.sku ILIKE $${idx} OR p.name ILIKE $${idx})`)
  }

  return { where, params }
}

const SORT_COLUMN: Record<CrmCatalogSortBy, string> = {
  sku: 'p.sku',
  price: 'p.price',
  inStock: 'p.in_stock',
  updatedAt: 'p.updated_at',
}

const buildListOrderBy = (filters: CrmCatalogListFilters): string => {
  const isValidSortBy =
    Boolean(filters.sortBy) &&
    Object.prototype.hasOwnProperty.call(SORT_COLUMN, filters.sortBy as CrmCatalogSortBy)
  const sortBy = isValidSortBy ? (filters.sortBy as CrmCatalogSortBy) : 'updatedAt'
  const defaultDir = sortBy === 'updatedAt' ? 'desc' : 'asc'
  const sortDir =
    isValidSortBy && (filters.sortDir === 'asc' || filters.sortDir === 'desc')
      ? filters.sortDir
      : defaultDir
  const column = SORT_COLUMN[sortBy]
  return `ORDER BY ${column} ${sortDir.toUpperCase()}, p.sku ASC`
}

export const getCrmCatalogMeta = (): CrmCatalogMeta => listMeta()

export const listCrmCatalogProducts = async (
  filters: CrmCatalogListFilters,
): Promise<CrmCatalogListResult> => {
  const page = normalizeAdminOrdersPage(filters.page)
  const pageSize = normalizeAdminOrdersPageSize(filters.pageSize)
  const offset = (page - 1) * pageSize

  const listFilters = buildListFilters(filters)
  const whereClause = listFilters.where.length > 0 ? `WHERE ${listFilters.where.join(' AND ')}` : ''

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total ${FROM_PRODUCT} ${whereClause}`,
    listFilters.params,
  )
  const total = Number(countResult.rows[0]?.total ?? 0)

  const listParams = [...listFilters.params, pageSize, offset]
  const limitIdx = listFilters.params.length + 1
  const offsetIdx = listFilters.params.length + 2

  const listResult = await pool.query<ProductRow>(
    `SELECT ${PRODUCT_SELECT}
     ${FROM_PRODUCT}
     ${whereClause}
     ${buildListOrderBy(filters)}
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  )

  return {
    items: listResult.rows.map(mapListRow),
    total,
    page,
    pageSize,
    ...listMeta(),
  }
}

export const getCrmCatalogProductById = async (id: number): Promise<CrmCatalogProductDetail | null> => {
  const result = await pool.query<ProductRow>(
    `SELECT ${PRODUCT_SELECT}
     ${FROM_PRODUCT}
     WHERE p.id = $1`,
    [id],
  )
  if (result.rows.length === 0) return null

  const subIdsResult = await pool.query<{ subcategory_id: number }>(
    `SELECT subcategory_id FROM product_subcategories
     WHERE product_id = $1
     ORDER BY position`,
    [id],
  )

  const product = mapDetailRow(result.rows[0])
  product.subcategoryIds = subIdsResult.rows.map((row) => row.subcategory_id)
  return product
}

type DenormSubcategory = {
  webSubcategoryName: string | null
  webSubcategorySlug: string | null
  subcategory: string | null
  subcategorySlug: string | null
}

const emptyDenormSubcategory = (): DenormSubcategory => ({
  webSubcategoryName: null,
  webSubcategorySlug: null,
  subcategory: null,
  subcategorySlug: null,
})

const resolveDenormFromSubcategoryIds = async (
  subcategoryIds: number[],
): Promise<DenormSubcategory> => {
  if (subcategoryIds.length === 0) return emptyDenormSubcategory()
  const primary = await getSubcategoryDenormById(subcategoryIds[0])
  if (!primary) return emptyDenormSubcategory()
  return {
    webSubcategoryName: primary.name,
    webSubcategorySlug: primary.slug,
    subcategory: primary.name,
    subcategorySlug: primary.slug,
  }
}

type DbClient = {
  query: (
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: Array<{ id: number }>; rowCount: number | null }>
}

const syncProductSubcategoryLinks = async (
  client: DbClient,
  productId: number,
  subcategoryIds: number[],
): Promise<void> => {
  await client.query(`DELETE FROM product_subcategories WHERE product_id = $1`, [productId])
  for (let i = 0; i < subcategoryIds.length; i++) {
    await client.query(
      `INSERT INTO product_subcategories (product_id, subcategory_id, position)
       VALUES ($1, $2, $3)`,
      [productId, subcategoryIds[i], i],
    )
  }
}

const resolveWebSubcategory = (name: string | null | undefined) => {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) return { name: null as string | null, slug: null as string | null }
  return { name: trimmed, slug: slugify(trimmed) }
}

const validateDimsOrThrow = (input: CreateCrmCatalogProductInput | PatchCrmCatalogProductInput) => {
  if (!hasDimsInput(input)) return
  const dims = extractDimsInput(input)
  if (!dims) {
    throw new Error('All dimension fields are required when updating dimensions')
  }
  const validation = validateProductDimsUpdate(dims)
  if (!validation.ok) {
    throw new Error(validation.message)
  }
}

const assertNotVirtualSaleCategory = async (
  categoryId: number | null | undefined,
): Promise<void> => {
  if (categoryId == null) return
  const { rows } = await pool.query<{ name: string }>(
    'SELECT name FROM categories WHERE id = $1',
    [categoryId],
  )
  if (rows[0]?.name === SALE_CATEGORY_NAME) {
    throw conflictError('Cannot assign a product directly to the virtual Sale category')
  }
}

export const createCrmCatalogProduct = async (
  input: CreateCrmCatalogProductInput,
): Promise<CrmCatalogProductDetail> => {
  assertCatalogCrmWritable()
  validateDimsOrThrow(input)

  const sku = input.sku.trim().toUpperCase()
  const existing = await pool.query('SELECT id FROM products WHERE sku = $1', [sku])
  if (existing.rows.length > 0) {
    throw conflictError(`Product with sku ${sku} already exists`)
  }

  if (input.categoryId != null) {
    await assertNotVirtualSaleCategory(input.categoryId)
  }

  if (input.subcategoryIds !== undefined) {
    await validateSubcategoryIdsExist(input.subcategoryIds)
  }

  const images = normalizeImageUrls(input.imageUrls, input.imageUrl1, input.imageUrl2)
  const dims = extractDimsInput(input)
  const denorm =
    input.subcategoryIds !== undefined
      ? await resolveDenormFromSubcategoryIds(input.subcategoryIds)
      : emptyDenormSubcategory()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const result = await client.query<{ id: number }>(
      `INSERT INTO products (
         sku, name, description, price, discount_percent, in_stock, specs,
         image_url_1, image_url_2, image_urls, category_id,
         color, size, color_tags, dimensions_label,
         weight_grams, dim_length_cm, dim_width_cm, dim_height_cm,
         dims_source, weight_source,
         web_subcategory_name, web_subcategory_slug,
         subcategory, subcategory_slug,
         is_gift_guide, is_archived, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7::jsonb,
         $8, $9, $10::jsonb, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19,
         $20, $21,
         $22, $23,
         $24, $25,
         $26, FALSE, NOW()
       ) RETURNING id`,
      [
        sku,
        input.name.trim(),
        input.description?.trim() ?? '',
        input.price,
        input.discountPercent ?? 0,
        input.inStock ?? 0,
        JSON.stringify(input.specs ?? {}),
        images.imageUrl1,
        images.imageUrl2,
        JSON.stringify(images.imageUrls),
        input.categoryId ?? null,
        input.color?.trim() ?? null,
        input.size?.trim() ?? null,
        input.colorTags ?? [],
        input.dimensionsLabel?.trim() ?? '',
        dims?.weightGrams ?? PRODUCT_DEFAULT_WEIGHT_GRAMS,
        dims?.lengthCm ?? PRODUCT_DEFAULT_DIM_LENGTH_CM,
        dims?.widthCm ?? PRODUCT_DEFAULT_DIM_WIDTH_CM,
        dims?.heightCm ?? PRODUCT_DEFAULT_DIM_HEIGHT_CM,
        dims ? 'manual' : 'auto',
        dims ? 'manual' : 'auto',
        denorm.webSubcategoryName,
        denorm.webSubcategorySlug,
        denorm.subcategory,
        denorm.subcategorySlug,
        input.isGiftGuide ?? false,
      ],
    )

    const productId = result.rows[0].id
    if (input.subcategoryIds !== undefined) {
      await syncProductSubcategoryLinks(client, productId, input.subcategoryIds)
    }

    await client.query('COMMIT')

    const product = await getCrmCatalogProductById(productId)
    if (!product) throw new Error('Product not found after create')
    return product
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const updateCrmCatalogProduct = async (
  id: number,
  input: PatchCrmCatalogProductInput,
): Promise<CrmCatalogProductDetail | null> => {
  assertCatalogCrmWritable()
  validateDimsOrThrow(input)

  if (input.categoryId !== undefined && input.categoryId != null) {
    await assertNotVirtualSaleCategory(input.categoryId)
  }

  if (input.subcategoryIds !== undefined) {
    await validateSubcategoryIdsExist(input.subcategoryIds)
  }

  const sets: string[] = ['updated_at = NOW()']
  const params: unknown[] = []

  if (input.name !== undefined) {
    params.push(input.name.trim())
    sets.push(`name = $${params.length}`)
  }
  if (input.description !== undefined) {
    params.push(input.description)
    sets.push(`description = $${params.length}`)
  }
  if (input.price !== undefined) {
    params.push(input.price)
    sets.push(`price = $${params.length}`)
  }
  if (input.discountPercent !== undefined) {
    params.push(input.discountPercent)
    sets.push(`discount_percent = $${params.length}`)
  }
  if (input.inStock !== undefined) {
    params.push(input.inStock)
    sets.push(`in_stock = $${params.length}`)
  }
  if (input.categoryId !== undefined) {
    params.push(input.categoryId)
    sets.push(`category_id = $${params.length}`)
  }
  if (input.color !== undefined) {
    params.push(input.color)
    sets.push(`color = $${params.length}`)
  }
  if (input.size !== undefined) {
    params.push(input.size)
    sets.push(`size = $${params.length}`)
  }
  if (input.colorTags !== undefined) {
    params.push(input.colorTags)
    sets.push(`color_tags = $${params.length}`)
  }
  if (input.dimensionsLabel !== undefined) {
    params.push(input.dimensionsLabel)
    sets.push(`dimensions_label = $${params.length}`)
  }
  if (input.isGiftGuide !== undefined) {
    params.push(input.isGiftGuide)
    sets.push(`is_gift_guide = $${params.length}`)
  }
  if (input.specs !== undefined) {
    params.push(JSON.stringify(input.specs))
    sets.push(`specs = $${params.length}::jsonb`)
  }
  if (input.imageUrls !== undefined || input.imageUrl1 !== undefined || input.imageUrl2 !== undefined) {
    const images = normalizeImageUrls(input.imageUrls, input.imageUrl1, input.imageUrl2)
    params.push(images.imageUrl1)
    sets.push(`image_url_1 = $${params.length}`)
    params.push(images.imageUrl2)
    sets.push(`image_url_2 = $${params.length}`)
    params.push(JSON.stringify(images.imageUrls))
    sets.push(`image_urls = $${params.length}::jsonb`)
  }

  if (input.subcategoryIds !== undefined) {
    const denorm = await resolveDenormFromSubcategoryIds(input.subcategoryIds)
    params.push(denorm.webSubcategoryName)
    sets.push(`web_subcategory_name = $${params.length}`)
    params.push(denorm.webSubcategorySlug)
    sets.push(`web_subcategory_slug = $${params.length}`)
    params.push(denorm.subcategory)
    sets.push(`subcategory = $${params.length}`)
    params.push(denorm.subcategorySlug)
    sets.push(`subcategory_slug = $${params.length}`)
  }

  const dims = extractDimsInput(input)
  if (dims) {
    params.push(dims.weightGrams)
    sets.push(`weight_grams = $${params.length}`)
    params.push(dims.lengthCm)
    sets.push(`dim_length_cm = $${params.length}`)
    params.push(dims.widthCm)
    sets.push(`dim_width_cm = $${params.length}`)
    params.push(dims.heightCm)
    sets.push(`dim_height_cm = $${params.length}`)
    sets.push(`dims_source = 'manual'`)
    sets.push(`weight_source = 'manual'`)
  }

  const hasSubcategorySync = input.subcategoryIds !== undefined
  if (sets.length === 1 && !hasSubcategorySync) {
    throw new Error('No fields to update')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (sets.length > 1) {
      params.push(id)
      const result = await client.query(
        `UPDATE products SET ${sets.join(', ')} WHERE id = $${params.length}`,
        params,
      )
      if ((result.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK')
        return null
      }
    } else {
      const exists = await client.query(`SELECT id FROM products WHERE id = $1`, [id])
      if (exists.rows.length === 0) {
        await client.query('ROLLBACK')
        return null
      }
    }

    if (hasSubcategorySync) {
      await syncProductSubcategoryLinks(client, id, input.subcategoryIds!)
    }

    await client.query('COMMIT')
    return getCrmCatalogProductById(id)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const setCrmCatalogProductArchived = async (
  id: number,
  archived: boolean,
): Promise<CrmCatalogProductDetail | null> => {
  assertCatalogCrmWritable()
  const result = await pool.query(
    `UPDATE products SET is_archived = $1, updated_at = NOW() WHERE id = $2`,
    [archived, id],
  )
  if ((result.rowCount ?? 0) === 0) return null
  return getCrmCatalogProductById(id)
}

export const updateCrmCatalogProductStock = async (
  id: number,
  inStock: number,
): Promise<CrmCatalogProductDetail | null> => {
  assertCatalogCrmWritable()
  const result = await pool.query(
    `UPDATE products SET in_stock = $1, updated_at = NOW() WHERE id = $2`,
    [inStock, id],
  )
  if ((result.rowCount ?? 0) === 0) return null
  return getCrmCatalogProductById(id)
}
