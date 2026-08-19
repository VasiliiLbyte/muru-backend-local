import { apiFetch } from './api'

const CRM_BASE = '/api/crm/promo-codes'

export type PromoDiscountType = 'percent' | 'fixed'

export type PromoDisplayStatus = 'Активен' | 'Истёк' | 'Отключён'

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
  telegramUserId: number | null
  customerId: number | null
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

export const listPromoCodes = () => apiFetch<AdminPromoCode[]>(CRM_BASE)

export const createPromoCode = (body: CreatePromoCodeInput) =>
  apiFetch<AdminPromoCode>(CRM_BASE, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const patchPromoCode = (id: number, body: UpdatePromoCodeInput) =>
  apiFetch<AdminPromoCode>(`${CRM_BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const deletePromoCode = (id: number) =>
  apiFetch<{ deleted: true }>(`${CRM_BASE}/${id}`, { method: 'DELETE' })

export const listPromoCodeUsages = (id: number) =>
  apiFetch<AdminPromoCodeUsage[]>(`${CRM_BASE}/${id}/usages`)
