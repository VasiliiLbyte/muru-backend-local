export type PromoDiscountType = 'percent' | 'fixed'

export type PromoDisplayStatus = 'Активен' | 'Истёк' | 'Отключён'

export const normalizePromoCode = (raw: string): string => raw.trim().toUpperCase()

export const normalizeMoney = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0
  return Number(value.toFixed(2))
}

export const calculatePromoDiscount = (
  discountType: PromoDiscountType,
  discountValue: number,
  subtotal: number,
): number => {
  const safeSubtotal = normalizeMoney(subtotal)
  if (safeSubtotal <= 0) return 0

  const raw =
    discountType === 'percent'
      ? (safeSubtotal * discountValue) / 100
      : discountValue

  return normalizeMoney(Math.min(raw, safeSubtotal))
}

export const resolvePromoDisplayStatus = (row: {
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
  usage_limit: number | null
  used_count: number
  now?: Date
}): PromoDisplayStatus => {
  if (!row.is_active) return 'Отключён'

  const now = row.now ?? new Date()
  if (row.starts_at && new Date(row.starts_at) > now) return 'Истёк'
  if (row.expires_at && new Date(row.expires_at) < now) return 'Истёк'
  if (row.usage_limit != null && row.used_count >= row.usage_limit) return 'Истёк'

  return 'Активен'
}
