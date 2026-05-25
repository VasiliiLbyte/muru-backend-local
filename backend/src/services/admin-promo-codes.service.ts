import { normalizePromoCode, resolvePromoDisplayStatus, type PromoDiscountType, type PromoDisplayStatus } from './promo.helpers'
import { pool } from '../utils/db'

export type AdminPromoCode = {
  id: number
  code: string
  discountType: PromoDiscountType
  discountValue: number
  minOrderAmount: number
  startsAt: string | null
  expiresAt: string | null
  usageLimit: number | null
  usageLimitPerUser: number
  usedCount: number
  isActive: boolean
  createdAt: string
  status: PromoDisplayStatus
}

export type AdminPromoCodeUsage = {
  id: number
  telegramUserId: number
  orderId: number | null
  usedAt: string
}

export type CreatePromoCodeInput = {
  code: string
  discountType: PromoDiscountType
  discountValue: number
  minOrderAmount?: number
  startsAt?: string | null
  expiresAt?: string | null
  usageLimit?: number | null
  usageLimitPerUser?: number
  isActive?: boolean
}

export type UpdatePromoCodeInput = Partial<CreatePromoCodeInput>

const mapRow = (row: {
  id: number
  code: string
  discount_type: PromoDiscountType
  discount_value: string
  min_order_amount: string
  starts_at: string | null
  expires_at: string | null
  usage_limit: number | null
  usage_limit_per_user: number
  used_count: number
  is_active: boolean
  created_at: string
}): AdminPromoCode => ({
  id: row.id,
  code: row.code,
  discountType: row.discount_type,
  discountValue: Number(row.discount_value),
  minOrderAmount: Number(row.min_order_amount),
  startsAt: row.starts_at,
  expiresAt: row.expires_at,
  usageLimit: row.usage_limit,
  usageLimitPerUser: row.usage_limit_per_user,
  usedCount: row.used_count,
  isActive: row.is_active,
  createdAt: row.created_at,
  status: resolvePromoDisplayStatus({
    is_active: row.is_active,
    starts_at: row.starts_at,
    expires_at: row.expires_at,
    usage_limit: row.usage_limit,
    used_count: row.used_count,
  }),
})

export const listPromoCodes = async (): Promise<AdminPromoCode[]> => {
  const result = await pool.query<{
    id: number
    code: string
    discount_type: PromoDiscountType
    discount_value: string
    min_order_amount: string
    starts_at: string | null
    expires_at: string | null
    usage_limit: number | null
    usage_limit_per_user: number
    used_count: number
    is_active: boolean
    created_at: string
  }>(
    `SELECT id, code, discount_type, discount_value::text, min_order_amount::text,
            starts_at::text, expires_at::text, usage_limit, usage_limit_per_user,
            used_count, is_active, created_at::text
     FROM promo_codes
     ORDER BY created_at DESC`,
  )
  return result.rows.map(mapRow)
}

export const createPromoCode = async (input: CreatePromoCodeInput): Promise<AdminPromoCode> => {
  const code = normalizePromoCode(input.code)
  const result = await pool.query<{
    id: number
    code: string
    discount_type: PromoDiscountType
    discount_value: string
    min_order_amount: string
    starts_at: string | null
    expires_at: string | null
    usage_limit: number | null
    usage_limit_per_user: number
    used_count: number
    is_active: boolean
    created_at: string
  }>(
    `INSERT INTO promo_codes (
       code, discount_type, discount_value, min_order_amount, starts_at, expires_at,
       usage_limit, usage_limit_per_user, is_active
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, code, discount_type, discount_value::text, min_order_amount::text,
               starts_at::text, expires_at::text, usage_limit, usage_limit_per_user,
               used_count, is_active, created_at::text`,
    [
      code,
      input.discountType,
      input.discountValue,
      input.minOrderAmount ?? 0,
      input.startsAt ?? null,
      input.expiresAt ?? null,
      input.usageLimit ?? null,
      input.usageLimitPerUser ?? 1,
      input.isActive ?? true,
    ],
  )
  return mapRow(result.rows[0])
}

export const updatePromoCode = async (
  id: number,
  input: UpdatePromoCodeInput,
): Promise<AdminPromoCode | null> => {
  const fields: string[] = []
  const params: unknown[] = []

  if (input.code !== undefined) {
    params.push(normalizePromoCode(input.code))
    fields.push(`code = $${params.length}`)
  }
  if (input.discountType !== undefined) {
    params.push(input.discountType)
    fields.push(`discount_type = $${params.length}`)
  }
  if (input.discountValue !== undefined) {
    params.push(input.discountValue)
    fields.push(`discount_value = $${params.length}`)
  }
  if (input.minOrderAmount !== undefined) {
    params.push(input.minOrderAmount)
    fields.push(`min_order_amount = $${params.length}`)
  }
  if (input.startsAt !== undefined) {
    params.push(input.startsAt)
    fields.push(`starts_at = $${params.length}`)
  }
  if (input.expiresAt !== undefined) {
    params.push(input.expiresAt)
    fields.push(`expires_at = $${params.length}`)
  }
  if (input.usageLimit !== undefined) {
    params.push(input.usageLimit)
    fields.push(`usage_limit = $${params.length}`)
  }
  if (input.usageLimitPerUser !== undefined) {
    params.push(input.usageLimitPerUser)
    fields.push(`usage_limit_per_user = $${params.length}`)
  }
  if (input.isActive !== undefined) {
    params.push(input.isActive)
    fields.push(`is_active = $${params.length}`)
  }

  if (fields.length === 0) {
    const existing = await pool.query<{ id: number }>(`SELECT id FROM promo_codes WHERE id = $1`, [id])
    if (!existing.rows[0]) return null
    const list = await listPromoCodes()
    return list.find((row) => row.id === id) ?? null
  }

  params.push(id)
  const result = await pool.query<{
    id: number
    code: string
    discount_type: PromoDiscountType
    discount_value: string
    min_order_amount: string
    starts_at: string | null
    expires_at: string | null
    usage_limit: number | null
    usage_limit_per_user: number
    used_count: number
    is_active: boolean
    created_at: string
  }>(
    `UPDATE promo_codes SET ${fields.join(', ')}
     WHERE id = $${params.length}
     RETURNING id, code, discount_type, discount_value::text, min_order_amount::text,
               starts_at::text, expires_at::text, usage_limit, usage_limit_per_user,
               used_count, is_active, created_at::text`,
    params,
  )
  if (!result.rows[0]) return null
  return mapRow(result.rows[0])
}

export const deletePromoCode = async (id: number): Promise<boolean> => {
  const result = await pool.query(`DELETE FROM promo_codes WHERE id = $1`, [id])
  return (result.rowCount ?? 0) > 0
}

export const listPromoCodeUsages = async (promoCodeId: number): Promise<AdminPromoCodeUsage[]> => {
  const result = await pool.query<{
    id: number
    telegram_user_id: string
    order_id: number | null
    used_at: string
  }>(
    `SELECT id, telegram_user_id::text, order_id, used_at::text
     FROM promo_code_usages
     WHERE promo_code_id = $1
     ORDER BY used_at DESC`,
    [promoCodeId],
  )
  return result.rows.map((row) => ({
    id: row.id,
    telegramUserId: Number(row.telegram_user_id),
    orderId: row.order_id,
    usedAt: row.used_at,
  }))
}
