import { pool } from '../utils/db'

import type { ProductDimsUpdateInput } from './admin-product-dims.validation'

export type { ProductDimsUpdateInput } from './admin-product-dims.validation'
export { validateProductDimsUpdate } from './admin-product-dims.validation'

export type ProductDimsFilter = 'all' | 'default' | 'manual'

export type ProductDimsRow = {
  sku: string
  name: string
  dimensions_label: string
  weight_grams: number
  weight_source: 'auto' | 'manual'
  dim_length_cm: number
  dim_width_cm: number
  dim_height_cm: number
  dims_source: 'auto' | 'manual'
  image_url_1: string
}

export const listProductDims = async (
  q: string,
  filter: ProductDimsFilter,
): Promise<ProductDimsRow[]> => {
  const params: unknown[] = []
  const where: string[] = []

  if (q) {
    params.push(`%${q}%`)
    where.push(`(p.sku ILIKE $${params.length} OR p.name ILIKE $${params.length})`)
  }
  if (filter === 'default') {
    where.push(`(p.dim_length_cm = 20 AND p.dim_width_cm = 20 AND p.dim_height_cm = 20)`)
  } else if (filter === 'manual') {
    where.push(`(p.dims_source = 'manual' OR p.weight_source = 'manual')`)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const result = await pool.query<ProductDimsRow>(
    `SELECT p.sku, p.name, p.dimensions_label,
            p.weight_grams, p.weight_source,
            p.dim_length_cm, p.dim_width_cm, p.dim_height_cm, p.dims_source,
            p.image_url_1
     FROM products p
     ${whereSql}
     ORDER BY p.sku
     LIMIT 200`,
    params,
  )
  return result.rows
}

export const updateProductDims = async (
  sku: string,
  input: ProductDimsUpdateInput,
): Promise<{ sku: string; weightGrams: number; lengthCm: number; widthCm: number; heightCm: number } | null> => {
  const result = await pool.query(
    `UPDATE products
     SET weight_grams = $1, dim_length_cm = $2, dim_width_cm = $3, dim_height_cm = $4,
         dims_source = 'manual', weight_source = 'manual', updated_at = NOW()
     WHERE sku = $5`,
    [input.weightGrams, input.lengthCm, input.widthCm, input.heightCm, sku],
  )
  if (result.rowCount === 0) return null
  return {
    sku,
    weightGrams: input.weightGrams,
    lengthCm: input.lengthCm,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
  }
}

export const resetProductDimsToAuto = async (sku: string): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE products SET dims_source = 'auto', weight_source = 'auto', updated_at = NOW() WHERE sku = $1`,
    [sku],
  )
  return (result.rowCount ?? 0) > 0
}
