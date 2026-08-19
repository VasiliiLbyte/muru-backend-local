import type { PoolClient } from 'pg'

import {
  calculatePromoDiscount,
  normalizeMoney,
  normalizePromoCode,
  type PromoDiscountType,
  type PromoDisplayStatus,
} from './promo.helpers'
import { pool } from '../utils/db'

export type { PromoDiscountType, PromoDisplayStatus }
export { normalizePromoCode, normalizeMoney, calculatePromoDiscount, resolvePromoDisplayStatus } from './promo.helpers'

export type ValidatePromoInput = {
  code: string
  subtotal: number
  telegramUserId?: number | null
  customerId?: number | null
}

export type ValidatePromoSuccess = {
  valid: true
  promoCodeId: number
  code: string
  discountType: PromoDiscountType
  discountValue: number
}

export type ValidatePromoFailure = {
  valid: false
  reason: string
}

export type ValidatePromoResult = ValidatePromoSuccess | ValidatePromoFailure

export type ApplyPromoOnOrderInput = {
  promoCodeId: number
  telegramUserId?: number | null
  customerId?: number | null
  orderId: number
}

export class PromoValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PromoValidationError'
  }
}

type PromoRow = {
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
}

const mapPromoFailure = (reason: string): ValidatePromoFailure => ({
  valid: false,
  reason,
})

export const validatePromoCode = async (input: ValidatePromoInput): Promise<ValidatePromoResult> => {
  const code = normalizePromoCode(input.code)
  if (!code) {
    return mapPromoFailure('Введите промокод')
  }

  const subtotal = normalizeMoney(input.subtotal)
  if (subtotal <= 0) {
    return mapPromoFailure('Добавьте товары в корзину')
  }

  const result = await pool.query<PromoRow>(
    `SELECT id, code, discount_type, discount_value::text, min_order_amount::text,
            starts_at::text, expires_at::text, usage_limit, usage_limit_per_user, used_count, is_active
     FROM promo_codes
     WHERE code = $1`,
    [code],
  )

  const row = result.rows[0]
  if (!row) {
    return mapPromoFailure('Промокод не найден')
  }

  if (!row.is_active) {
    return mapPromoFailure('Промокод отключён')
  }

  const now = new Date()
  if (row.starts_at && new Date(row.starts_at) > now) {
    return mapPromoFailure('Промокод ещё не действует')
  }
  if (row.expires_at && new Date(row.expires_at) < now) {
    return mapPromoFailure('Срок действия промокода истёк')
  }

  const minOrder = Number(row.min_order_amount)
  if (subtotal < minOrder) {
    return mapPromoFailure(`Минимальная сумма заказа: ${minOrder} ₽`)
  }

  if (row.usage_limit != null && row.used_count >= row.usage_limit) {
    return mapPromoFailure('Промокод исчерпан')
  }

  const telegramUserId = input.telegramUserId != null && input.telegramUserId > 0 ? input.telegramUserId : null
  const customerId = input.customerId != null && input.customerId > 0 ? input.customerId : null

  // Important: for web guests without identity, per-user usage checks are skipped entirely.
  let userUsageCount = 0
  if (telegramUserId != null) {
    const usageResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM promo_code_usages
       WHERE promo_code_id = $1 AND telegram_user_id = $2`,
      [row.id, telegramUserId],
    )
    userUsageCount = Number(usageResult.rows[0]?.count ?? 0)
  } else if (customerId != null) {
    const usageResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM promo_code_usages
       WHERE promo_code_id = $1 AND customer_id = $2`,
      [row.id, customerId],
    )
    userUsageCount = Number(usageResult.rows[0]?.count ?? 0)
  }

  if (userUsageCount >= row.usage_limit_per_user) {
    return mapPromoFailure('Вы уже использовали этот промокод')
  }

  const discountValue = calculatePromoDiscount(
    row.discount_type,
    Number(row.discount_value),
    subtotal,
  )

  if (discountValue <= 0) {
    return mapPromoFailure('Промокод не применим к этому заказу')
  }

  return {
    valid: true,
    promoCodeId: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue,
  }
}

export const applyPromoCodeOnOrder = async (
  client: PoolClient,
  input: ApplyPromoOnOrderInput,
): Promise<void> => {
  const telegramUserId =
    input.telegramUserId != null && input.telegramUserId > 0 ? input.telegramUserId : null
  const customerId =
    input.customerId != null && input.customerId > 0 ? input.customerId : null

  let telegramUserIdToInsert: number | null
  let customerIdToInsert: number | null

  if (telegramUserId != null) {
    telegramUserIdToInsert = telegramUserId
    customerIdToInsert = null
  } else if (customerId != null) {
    telegramUserIdToInsert = null
    customerIdToInsert = customerId
  } else {
    telegramUserIdToInsert = 0
    customerIdToInsert = null
  }

  await client.query(
    `INSERT INTO promo_code_usages (promo_code_id, telegram_user_id, customer_id, order_id)
     VALUES ($1, $2, $3, $4)`,
    [input.promoCodeId, telegramUserIdToInsert, customerIdToInsert, input.orderId],
  )
  await client.query(`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1`, [
    input.promoCodeId,
  ])
}
