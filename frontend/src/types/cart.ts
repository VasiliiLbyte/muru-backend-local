export type DeliveryMode = 'delivery' | 'pickup'

export type CartItem = {
  sku: string
  name: string
  price: number
  quantity: number
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
  items: CartItem[]
}
