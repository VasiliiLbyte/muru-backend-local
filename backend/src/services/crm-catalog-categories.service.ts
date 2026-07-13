import type {
  CreateCrmCategoryInput,
  PatchCrmCategoryInput,
  RenameCrmSubcategoryInput,
} from '../schemas/crm-catalog.schemas'
import { pool } from '../utils/db'

import { assertCatalogCrmWritable } from './catalog-source.guard'
import {
  conflictError,
  isForeignKeyViolation,
  isUniqueViolation,
  slugify,
} from './crm-catalog.helpers'

export type CrmCategorySubcategoryItem = {
  name: string
  slug: string
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
  name: string
  slug: string
  product_count: number
}

const mapCategoryRow = (
  row: CategoryRow,
  subcategories: CrmCategorySubcategoryItem[],
): CrmCategoryItem => {
  const directProductCount = row.direct_product_count
  const crossPlacementCount = row.cross_placement_count
  const isUnused =
    directProductCount === 0 && subcategories.length === 0 && crossPlacementCount === 0

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
              COUNT(DISTINCT p.id) FILTER (WHERE p.is_archived = FALSE)::int AS direct_product_count,
              COUNT(DISTINCT pwcp.product_id) FILTER (
                WHERE pwcp.product_id IS NOT NULL AND p2.is_archived = FALSE
              )::int AS cross_placement_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       LEFT JOIN product_web_cross_placements pwcp ON pwcp.category_id = c.id
       LEFT JOIN products p2 ON p2.id = pwcp.product_id
       GROUP BY c.id
       ORDER BY c.name`,
    ),
    pool.query<SubcategoryRow>(
      `SELECT p.category_id,
              TRIM(p.web_subcategory_name) AS name,
              TRIM(p.web_subcategory_slug) AS slug,
              COUNT(*)::int AS product_count
       FROM products p
       WHERE p.is_archived = FALSE
         AND p.category_id IS NOT NULL
         AND TRIM(COALESCE(p.web_subcategory_name, '')) <> ''
       GROUP BY p.category_id, TRIM(p.web_subcategory_name), TRIM(p.web_subcategory_slug)
       ORDER BY p.category_id, name`,
    ),
  ])

  const subcategoriesByCategory = new Map<number, CrmCategorySubcategoryItem[]>()
  for (const row of subcategoriesResult.rows) {
    const list = subcategoriesByCategory.get(row.category_id) ?? []
    list.push({
      name: row.name,
      slug: row.slug,
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

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM products
     WHERE category_id = $1 AND is_archived = FALSE`,
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
