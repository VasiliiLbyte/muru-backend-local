import {
  PRODUCT_DEFAULT_DIM_HEIGHT_CM,
  PRODUCT_DEFAULT_DIM_LENGTH_CM,
  PRODUCT_DEFAULT_DIM_WIDTH_CM,
  PRODUCT_DEFAULT_WEIGHT_GRAMS,
} from '../../constants/product-shipping-defaults'
import { pool } from '../../utils/db'
import type { CalcPackage } from './calc.service'

export const buildPackagesFromCart = async (
  items: Array<{ sku: string; quantity: number }>,
): Promise<CalcPackage[]> => {
  if (items.length === 0) return [{ weight: PRODUCT_DEFAULT_WEIGHT_GRAMS }]
  const skus = items.map((i) => i.sku)
  const res = await pool.query<{
    sku: string
    weight_grams: number
    dim_length_cm: number
    dim_width_cm: number
    dim_height_cm: number
  }>(
    `SELECT sku, weight_grams, dim_length_cm, dim_width_cm, dim_height_cm FROM products WHERE sku = ANY($1::text[])`,
    [skus],
  )
  const map = new Map(res.rows.map((r) => [r.sku, r]))
  let weight = 0
  let length = 0
  let width = 0
  let height = 0
  for (const item of items) {
    const row = map.get(item.sku)
    const w = row?.weight_grams ?? PRODUCT_DEFAULT_WEIGHT_GRAMS
    const l = row?.dim_length_cm ?? PRODUCT_DEFAULT_DIM_LENGTH_CM
    const wd = row?.dim_width_cm ?? PRODUCT_DEFAULT_DIM_WIDTH_CM
    const h = row?.dim_height_cm ?? PRODUCT_DEFAULT_DIM_HEIGHT_CM
    weight += w * item.quantity
    length = Math.max(length, l)
    width = Math.max(width, wd)
    height = Math.max(height, h)
  }
  return [{ weight: Math.max(weight, 100), length, width, height }]
}
