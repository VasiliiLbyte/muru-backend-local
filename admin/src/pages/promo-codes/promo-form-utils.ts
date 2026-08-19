import type { AdminPromoCode, CreatePromoCodeInput, PromoDiscountType } from '../../lib/promo-codes-api'
import { datetimeLocalToIso, isoToDatetimeLocal } from '../../utils/datetime'

export type PromoFormState = {
  code: string
  discountType: PromoDiscountType
  discountValue: string
  minOrderAmount: string
  startsAt: string
  expiresAt: string
  usageLimit: string
  usageLimitPerUser: string
  isActive: boolean
}

export const emptyPromoForm = (): PromoFormState => ({
  code: '',
  discountType: 'percent',
  discountValue: '10',
  minOrderAmount: '0',
  startsAt: '',
  expiresAt: '',
  usageLimit: '',
  usageLimitPerUser: '1',
  isActive: true,
})

export const promoFormFromCode = (promo: AdminPromoCode): PromoFormState => ({
  code: promo.code,
  discountType: promo.discountType,
  discountValue: String(promo.discountValue),
  minOrderAmount: String(promo.minOrderAmount),
  startsAt: isoToDatetimeLocal(promo.startsAt),
  expiresAt: isoToDatetimeLocal(promo.expiresAt),
  usageLimit: promo.usageLimit != null ? String(promo.usageLimit) : '',
  usageLimitPerUser: String(promo.usageLimitPerUser),
  isActive: promo.isActive,
})

export const validatePromoForm = (form: PromoFormState): string | null => {
  if (!form.code.trim()) return 'Введите код промокода'

  const discountValue = Number(form.discountValue)
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return 'Укажите размер скидки'
  }

  if (form.discountType === 'percent') {
    if (discountValue < 1 || discountValue > 100) {
      return 'Скидка в процентах: от 1 до 100'
    }
  }

  const usageLimitPerUser = Number(form.usageLimitPerUser)
  if (!Number.isInteger(usageLimitPerUser) || usageLimitPerUser < 1) {
    return 'Лимит на пользователя: целое число от 1'
  }

  const usageLimitRaw = form.usageLimit.trim()
  if (usageLimitRaw) {
    const usageLimit = Number(usageLimitRaw)
    if (!Number.isInteger(usageLimit) || usageLimit < 1) {
      return 'Общий лимит: целое число от 1 или пусто'
    }
  }

  return null
}

export const buildPromoPayload = (form: PromoFormState): CreatePromoCodeInput => {
  const usageLimitRaw = form.usageLimit.trim()
  return {
    code: form.code.trim(),
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    minOrderAmount: Number(form.minOrderAmount) || 0,
    startsAt: datetimeLocalToIso(form.startsAt),
    expiresAt: datetimeLocalToIso(form.expiresAt),
    usageLimit: usageLimitRaw ? Number(usageLimitRaw) : null,
    usageLimitPerUser: Number(form.usageLimitPerUser) || 1,
    isActive: form.isActive,
  }
}

export const formatPromoPeriod = (
  startsAt: string | null,
  expiresAt: string | null,
): string => {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

  if (startsAt && expiresAt) return `${fmt(startsAt)} – ${fmt(expiresAt)}`
  if (startsAt) return `с ${fmt(startsAt)}`
  if (expiresAt) return `до ${fmt(expiresAt)}`
  return '—'
}

export const promoStatusBadgeVariant = (
  status: AdminPromoCode['status'],
): 'success' | 'warning' | 'neutral' => {
  if (status === 'Активен') return 'success'
  if (status === 'Истёк') return 'warning'
  return 'neutral'
}

export const formatDiscountType = (type: PromoDiscountType): string =>
  type === 'percent' ? '%' : '₽'
