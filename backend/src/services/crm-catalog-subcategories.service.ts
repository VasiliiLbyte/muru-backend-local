import type {
  CreateCrmSubcategoryInput,
  PatchCrmSubcategoryInput,
} from '../schemas/crm-catalog.schemas'
import { pool } from '../utils/db'

import { assertCatalogCrmWritable } from './catalog-source.guard'
import { conflictError, isUniqueViolation, slugify } from './crm-catalog.helpers'

export type CrmSubcategoryItem = {
  id: number
  categoryId: number
  name: string
  slug: string
  coverImageUrl: string | null
  sortOrder: number
  productCount: number
}

type SubcategoryRow = {
  id: number
  category_id: number
  name: string
  slug: string
  cover_image_url: string | null
  sort_order: number
  product_count: number
}

const mapRow = (row: SubcategoryRow): CrmSubcategoryItem => ({
  id: row.id,
  categoryId: row.category_id,
  name: row.name,
  slug: row.slug,
  coverImageUrl: row.cover_image_url,
  sortOrder: row.sort_order,
  productCount: row.product_count,
})

const SUBCATEGORY_SELECT = `
  SELECT s.id, s.category_id, s.name, s.slug, s.cover_image_url, s.sort_order,
         COUNT(DISTINCT ps.product_id) FILTER (WHERE p.is_archived = FALSE)::int AS product_count
  FROM subcategories s
  LEFT JOIN product_subcategories ps ON ps.subcategory_id = s.id
  LEFT JOIN products p ON p.id = ps.product_id
`

export const listCrmSubcategories = async (categoryId: number): Promise<CrmSubcategoryItem[]> => {
  const result = await pool.query<SubcategoryRow>(
    `${SUBCATEGORY_SELECT}
     WHERE s.category_id = $1
     GROUP BY s.id
     ORDER BY s.sort_order, s.name`,
    [categoryId],
  )
  return result.rows.map(mapRow)
}

export const createCrmSubcategory = async (
  categoryId: number,
  input: CreateCrmSubcategoryInput,
): Promise<CrmSubcategoryItem> => {
  assertCatalogCrmWritable()

  const name = input.name.trim()
  const slug = slugify(name)

  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO subcategories (category_id, name, slug, cover_image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [categoryId, name, slug, input.coverImageUrl ?? null],
    )
    const items = await listCrmSubcategories(categoryId)
    const created = items.find((item) => item.id === result.rows[0].id)
    if (!created) throw new Error('Subcategory not found after create')
    return created
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflictError('Subcategory with this slug already exists in category')
    }
    throw error
  }
}

export const updateCrmSubcategory = async (
  categoryId: number,
  subcategoryId: number,
  input: PatchCrmSubcategoryInput,
): Promise<CrmSubcategoryItem | null> => {
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
  }
  if (input.sortOrder !== undefined) {
    params.push(input.sortOrder)
    sets.push(`sort_order = $${params.length}`)
  }

  if (sets.length === 0) {
    throw new Error('No fields to update')
  }

  params.push(subcategoryId, categoryId)

  try {
    const result = await pool.query(
      `UPDATE subcategories SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND category_id = $${params.length}`,
      params,
    )
    if ((result.rowCount ?? 0) === 0) return null

    const items = await listCrmSubcategories(categoryId)
    return items.find((item) => item.id === subcategoryId) ?? null
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflictError('Subcategory with this slug already exists in category')
    }
    throw error
  }
}

export const deleteCrmSubcategory = async (
  categoryId: number,
  subcategoryId: number,
): Promise<boolean> => {
  assertCatalogCrmWritable()

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM product_subcategories ps
     INNER JOIN products p ON p.id = ps.product_id AND p.is_archived = FALSE
     WHERE ps.subcategory_id = $1`,
    [subcategoryId],
  )
  const activeCount = Number(countResult.rows[0]?.count ?? 0)
  if (activeCount > 0) {
    throw conflictError('Subcategory has active products')
  }

  const result = await pool.query(
    `DELETE FROM subcategories WHERE id = $1 AND category_id = $2`,
    [subcategoryId, categoryId],
  )
  return (result.rowCount ?? 0) > 0
}

export const getSubcategoryDenormById = async (
  subcategoryId: number,
): Promise<{ name: string; slug: string } | null> => {
  const result = await pool.query<{ name: string; slug: string }>(
    `SELECT name, slug FROM subcategories WHERE id = $1`,
    [subcategoryId],
  )
  return result.rows[0] ?? null
}

export const validateSubcategoryIdsExist = async (ids: number[]): Promise<void> => {
  if (ids.length === 0) return
  const result = await pool.query<{ id: number }>(
    `SELECT id FROM subcategories WHERE id = ANY($1::int[])`,
    [ids],
  )
  if (result.rows.length !== ids.length) {
    const found = new Set(result.rows.map((row) => row.id))
    const missing = ids.filter((id) => !found.has(id))
    const err = new Error(`Unknown subcategory id(s): ${missing.join(', ')}`)
    ;(err as Error & { statusCode?: number }).statusCode = 400
    throw err
  }
}
