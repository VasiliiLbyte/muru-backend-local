export type DeliveryMode = 'delivery' | 'pickup'

export type OrderItemInput = {
  sku: string
  name: string
  price: number
  quantity: number
  color?: string
  size?: string
}

export type CheckoutDraftInput = {
  telegramUserId: number
  items: OrderItemInput[]
  deliveryMode: DeliveryMode
  deliveryOption?: string
  deliveryPrice?: number
  deliveryEta?: string
  address?: string
  comment?: string
  birthDate?: string
  promoCode?: string
  cdekTariffCode?: number
  cdekCityCode?: number
  cdekCityName?: string
  cdekPvzCode?: string | null
  cdekPvzAddress?: string | null
  recipientName?: string
  recipientPhone?: string
  consentAccepted?: boolean
  consentVersion?: string
}

export type OrderDraft = {
  id: number
  telegramUserId: number
  status: string
  deliveryMode: DeliveryMode
  deliveryOption: string | null
  deliveryPrice: number
  deliveryEta: string | null
  address: string
  comment: string
  birthDate: string | null
  subtotal: number
  total: number
  promoCode?: string | null
  promoDiscount?: number
  cdekTariffCode?: number | null
  cdekCityCode?: number | null
  cdekCityName?: string | null
  cdekPvzCode?: string | null
  cdekPvzAddress?: string | null
  recipientName?: string | null
  recipientPhone?: string | null
  items: OrderItemInput[]
}

export type OrderHistoryItem = {
  id: number
  createdAt: string
  status: string
  total: number
  promoCode?: string | null
  promoDiscount?: number
  items: OrderItemInput[]
}

