export type StockMovementType = 'sale' | 'return' | 'adjustment'

export type StockActorType = 'system' | 'admin'

export type CrmStockMovementRow = {
  id: number
  createdAt: string
  productId: number | null
  productSku: string
  productName: string
  type: StockMovementType
  delta: number
  stockAfter: number
  reason: string
  orderId: number | null
  actorType: StockActorType
  actorAdminId: number | null
  actorLabel: string | null
}

export type CrmStockMovementsListParams = {
  q?: string
  type?: StockMovementType
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export type CrmStockMovementsListResult = {
  rows: CrmStockMovementRow[]
  total: number
  page: number
  pageSize: number
}
