export type OrderChannel = 'telegram' | 'web'

export type DeliveryMode = 'delivery' | 'pickup'

export type CrmOrderListItem = {
  id: number
  channel: OrderChannel
  status: string
  total: number
  deliveryMode: DeliveryMode
  createdAt: string
  itemsCount: number
  customerName: string | null
  customerPhone: string | null
  paymentStatus: string | null
  paidAt: string | null
  telegramUserId: number | null
}

export type CrmOrderDetailItem = {
  sku: string
  name: string
  price: number
  quantity: number
  color?: string
  size?: string
  imageUrl: string | null
}

export type CrmOrderDetail = CrmOrderListItem & {
  subtotal: number
  deliveryOption: string | null
  deliveryPrice: number
  deliveryEta: string | null
  address: string
  comment: string
  adminComment: string
  updatedAt: string
  promoCode: string | null
  promoDiscount: number
  consentAccepted: boolean
  consentVersion: string | null
  consentAcceptedAt: string | null
  cdekTariffCode: number | null
  cdekCityCode: number | null
  cdekCityName: string | null
  cdekPvzCode: string | null
  cdekPvzAddress: string | null
  cdekRecipientName: string | null
  cdekRecipientPhone: string | null
  cdekSyncState: string
  cdekUuid: string | null
  cdekTrackNumber: string | null
  cdekStatus: string | null
  cdekStatusUpdatedAt: string | null
  cdekCreateError: string | null
  paymentId: string | null
  items: CrmOrderDetailItem[]
}

export type CrmOrdersListResult = {
  items: CrmOrderListItem[]
  total: number
  page: number
  pageSize: number
  statusCounts: Record<string, number>
}

export type CrmOrderPatchBody = {
  status?: string
  adminComment?: string
  deliveryEta?: string | null
}

export type CrmOrdersListParams = {
  channel?: OrderChannel
  status?: string
  q?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}
