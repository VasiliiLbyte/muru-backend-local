export type DeliveryMode = 'delivery' | 'pickup'

export type CdekCheckoutExtras = {
  cdekTariffCode?: number
  cdekCityCode?: number
  cdekCityName?: string
  cdekPvzCode?: string | null
  cdekPvzAddress?: string | null
}

export type CartItem = {
  sku: string
  name: string
  price: number
  quantity: number
  imageUrl?: string
  color?: string
  size?: string
}

export type CheckoutForm = {
  deliveryMode: DeliveryMode
  deliveryOption: string
  deliveryPrice: number
  deliveryEta: string
  address: string
  comment: string
  birthDate: string
  cdekExtras?: CdekCheckoutExtras
  recipientName?: string
  recipientPhone?: string
}

export type DraftOrder = {
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
  cdekTariffCode?: number | null
  cdekCityCode?: number | null
  cdekCityName?: string | null
  cdekPvzCode?: string | null
  cdekPvzAddress?: string | null
  recipientName?: string | null
  recipientPhone?: string | null
  items: CartItem[]
}

export type ProfileData = {
  telegramUserId: number
  fullName: string
  phone: string
  deliveryAddresses: string[]
}

export type OrderHistoryItem = {
  id: number
  createdAt: string
  status: string
  total: number
  items: CartItem[]
  deliveryMode?: 'delivery' | 'pickup'
  deliveryOption?: string | null
  deliveryPrice?: number
  deliveryEta?: string | null
  address?: string
  subtotal?: number
  promoDiscount?: number
  cdekPvzAddress?: string | null
  cdekRecipientName?: string | null
  cdekRecipientPhone?: string | null
  cdekTrackNumber?: string | null
  cdekStatus?: string | null
}
