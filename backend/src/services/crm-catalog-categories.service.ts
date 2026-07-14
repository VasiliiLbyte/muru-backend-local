import type {
  CreateCrmCategoryInput,
  PatchCrmCategoryInput,
  RenameCrmSubcategoryInput,
} from '../schemas/crm-catalog.schemas'
import { SALE_CATEGORY_NAME } from '../constants/catalog-top-level'
import { pool } from '../utils/db'

import { assertCatalogCrmWritable } from './catalog-source.guard'
import {
  conflictError,
  isForeignKeyViolation,
  isUniqueViolation,
  slugify,
} from './crm-catalog.helpers'

export type CrmCategorySubcategoryItem = {
  id: number
  name: string
  slug: string
  coverImageUrl: string | null
  sortOrder: number
  productCount: number
}

export type CrmCategoryItem = {
  id: number
  name: string
  slug: string
  coverImageUrl: string | null
  coverDriveFilename: string | null
  productCount: number
  directProductCount: number
  subcategories: CrmCategorySubcategoryItem[]
  crossPlacementCount: number
  isUnused: boolean
}

type CategoryRow = {
  id: number
  name: string
  slug: string
  cover_image_url: string | null
  cover_drive_filename: string | null
  direct_product_count: number
  cross_placement_count: number
}

type SubcategoryRow = {
  category_id: number
  id: number
  name: string
  slug: string
  cover_image_url: string | null
  sort_order: number
  product_count: number
}

const MEMBERSHIP_COUNT_SQL = `
  (SELECT COUNT(DISTINCT pid)::int FROM (
     SELECT p.id AS pid FROM products p
     WHERE p.category_id = c.id AND p.is_archived = FALSE
     UNION
     SELECT p.id AS pid FROM products p
     INNER JOIN product_subcategories ps ON ps.product_id = p.id
     INNER JOIN subcategories s ON s.id = ps.subcategory_id AND s.category_id = c.id
     WHERE p.is_archived = FALSE
   ) AS members) AS direct_product_count`

const mapCategoryRow = (
  row: CategoryRow,
  subcategories: CrmCategorySubcategoryItem[],
): CrmCategoryItem => {
  const directProductCount = row.direct_product_count
  const crossPlacementCount = row.cross_placement_count
  const isUnused =
    directProductCount === 0 &&
    crossPlacementCount === 0 &&
    subcategories.every((s) => s.productCount === 0)

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    coverImageUrl: row.cover_image_url,
    coverDriveFilename: row.cover_drive_filename,
    productCount: directProductCount,
    directProductCount,
    subcategories,
    crossPlacementCount,
    isUnused,
  }
}

export const listCrmCategories = async (): Promise<CrmCategoryItem[]> => {
  const [categoriesResult, subcategoriesResult] = await Promise.all([
    pool.query<CategoryRow>(
      `SELECT c.id, c.name, c.slug, c.cover_image_url, c.cover_drive_filename,
              ${MEMBERSHIP_COUNT_SQL},
              COUNT(DISTINCT pwcp.product_id) FILTER (
                WHERE pwcp.product_id IS NOT NULL AND p2.is_archived = FALSE
              )::int AS cross_placement_count
       FROM categories c
       LEFT JOIN product_web_cross_placements pwcp ON pwcp.category_id = c.id
       LEFT JOIN products p2 ON p2.id = pwcp.product_id
       GROUP BY c.id
       ORDER BY c.name`,
    ),
    pool.query<SubcategoryRow>(
      `SELECT s.category_id, s.id, s.name, s.slug, s.cover_image_url, s.sort_order,
              COUNT(DISTINCT ps.product_id) FILTER (WHERE p.is_archived = FALSE)::int AS product_count
       FROM subcategories s
       LEFT JOIN product_subcategories ps ON ps.subcategory_id = s.id
       LEFT JOIN products p ON p.id = ps.product_id
       GROUP BY s.id
       ORDER BY s.category_id, s.sort_order, s.name`,
    ),
  ])

  const subcategoriesByCategory = new Map<number, CrmCategorySubcategoryItem[]>()
  for (const row of subcategoriesResult.rows) {
    const list = subcategoriesByCategory.get(row.category_id) ?? []
    list.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      coverImageUrl: row.cover_image_url,
      sortOrder: row.sort_order,
      productCount: row.product_count,
    })
    subcategoriesByCategory.set(row.category_id, list)
  }

  return categoriesResult.rows.map((row) =>
    mapCategoryRow(row, subcategoriesByCategory.get(row.id) ?? []),
  )
}

export const createCrmCategory = async (input: CreateCrmCategoryInput): Promise<CrmCategoryItem> => {
  assertCatalogCrmWritable()
  const name = input.name.trim()
  const slug = slugify(name)

  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id`,
      [name, slug],
    )
    const categories = await listCrmCategories()
    const created = categories.find((c) => c.id === result.rows[0].id)
    if (!created) throw new Error('Category not found after create')
    return created
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflictError(`Category with name or slug already exists`)
    }
    throw error
  }
}

export const updateCrmCategory = async (
  id: number,
  input: PatchCrmCategoryInput,
): Promise<CrmCategoryItem | null> => {
  assertCatalogCrmWritable()

  const current = await pool.query<{ name: string; slug: string }>(
    'SELECT name, slug FROM categories WHERE id = $1',
    [id],
  )
  const row = current.rows[0]
  if (row?.name === SALE_CATEGORY_NAME) {
    if (input.name !== undefined && input.name.trim() !== SALE_CATEGORY_NAME) {
      throw conflictError('Sale category name cannot be changed')
    }
    if (input.slug !== undefined && input.slug.trim() !== row.slug) {
      throw conflictError('Sale category slug cannot be changed')
    }
  }

  const sets: string[] = []
  const params: unknown[] = []

  if (input.name !== undefined) {
    const name = input.name.trim()
    params.push(name)
    sets.push(`name = $${params.length}`)
    if (input.slug === undefined) {
      params.push(slugify(name))
      sets.push(`slug = $${params.length}`)
    }
  }
  if (input.slug !== undefined) {
    params.push(input.slug.trim())
    sets.push(`slug = $${params.length}`)
  }
  if (input.coverImageUrl !== undefined) {
    params.push(input.coverImageUrl)
    sets.push(`cover_image_url = $${params.length}`)
    sets.push(`cover_drive_filename = NULL`)
  }

  if (sets.length === 0) {
    throw new Error('No fields to update')
  }

  params.push(id)

  try {
    const result = await pool.query(
      `UPDATE categories SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    )
    if ((result.rowCount ?? 0) === 0) return null

    const categories = await listCrmCategories()
    return categories.find((c) => c.id === id) ?? null
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflictError(`Category with name or slug already exists`)
    }
    throw error
  }
}

export const deleteCrmCategory = async (id: number): Promise<boolean> => {
  assertCatalogCrmWritable()

  const nameRow = await pool.query<{ name: string }>(
    'SELECT name FROM categories WHERE id = $1',
    [id],
  )
  if (nameRow.rows[0]?.name === SALE_CATEGORY_NAME) {
    throw conflictError('Sale category is virtual and cannot be deleted')
  }

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(DISTINCT p.id)::text AS count
     FROM products p
     WHERE p.is_archived = FALSE
       AND (
         p.category_id = $1
         OR EXISTS (
           SELECT 1 FROM product_subcategories ps
           JOIN subcategories s ON s.id = ps.subcategory_id
           WHERE ps.product_id = p.id AND s.category_id = $1
         )
       )`,
    [id],
  )
  const activeCount = Number(countResult.rows[0]?.count ?? 0)
  if (activeCount > 0) {
    throw conflictError('Category has active products')
  }

  const crossResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM product_web_cross_placements pwcp
     INNER JOIN products p ON p.id = pwcp.product_id AND p.is_archived = FALSE
     WHERE pwcp.category_id = $1`,
    [id],
  )
  const crossCount = Number(crossResult.rows[0]?.count ?? 0)
  if (crossCount > 0) {
    throw conflictError('Category is used in web cross placements')
  }

  try {
    const result = await pool.query(`DELETE FROM categories WHERE id = $1`, [id])
    return (result.rowCount ?? 0) > 0
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw conflictError('Category is referenced by other records')
    }
    throw error
  }
}

export const renameCrmSubcategory = async (
  input: RenameCrmSubcategoryInput,
): Promise<{ updatedCount: number }> => {
  assertCatalogCrmWritable()

  const newName = input.newSubcategoryName.trim()
  const newSlug = slugify(newName)
  const oldName = input.oldSubcategoryName.trim()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<{ id: number }>(
      `UPDATE products SET
         web_subcategory_name = $1,
         web_subcategory_slug = $2,
         subcategory = $1,
         subcategory_slug = $2,
         updated_at = NOW()
       WHERE category_id = $3
         AND (web_subcategory_name ILIKE $4 OR subcategory ILIKE $4)
       RETURNING id`,
      [newName, newSlug, input.categoryId, oldName],
    )
    await client.query('COMMIT')
    return { updatedCount: result.rows.length }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
