import type {
  CreateCrmCategoryInput,
  PatchCrmCategoryInput,
  RenameCrmSubcategoryInput,
} from '../schemas/crm-catalog.schemas'
import { pool } from '../utils/db'

import { assertCatalogCrmWritable } from './catalog-source.guard'
import { conflictError, isUniqueViolation, slugify } from './crm-catalog.helpers'

export type CrmCategoryItem = {
  id: number
  name: string
  slug: string
  coverImageUrl: string | null
  coverDriveFilename: string | null
  productCount: number
}

type CategoryRow = {
  id: number
  name: string
  slug: string
  cover_image_url: string | null
  cover_drive_filename: string | null
  product_count: number
}

const mapCategoryRow = (row: CategoryRow): CrmCategoryItem => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  coverImageUrl: row.cover_image_url,
  coverDriveFilename: row.cover_drive_filename,
  productCount: row.product_count,
})

export const listCrmCategories = async (): Promise<CrmCategoryItem[]> => {
  const result = await pool.query<CategoryRow>(
    `SELECT c.id, c.name, c.slug, c.cover_image_url, c.cover_drive_filename,
            COUNT(p.id) FILTER (WHERE p.is_archived = FALSE)::int AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.name`,
  )
  return result.rows.map(mapCategoryRow)
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

  const result = await pool.query(`DELETE FROM categories WHERE id = $1`, [id])
  return (result.rowCount ?? 0) > 0
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
