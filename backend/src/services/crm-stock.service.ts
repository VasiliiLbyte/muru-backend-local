import { pool } from '../utils/db'

import {
  normalizeAdminOrdersPage,
  normalizeAdminOrdersPageSize,
} from './admin-orders.helpers'

export const STOCK_MOVEMENT_TYPES = ['sale', 'return', 'adjustment'] as const

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

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

export type CrmStockMovementsFilters = {
  q?: string
  type?: string
  dateFrom?: string
  dateTo?: string
  page?: unknown
  pageSize?: unknown
}

export type CrmStockMovementsListResult = {
  rows: CrmStockMovementRow[]
  total: number
  page: number
  pageSize: number
}

export class CrmStockValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CrmStockValidationError'
  }
}

export const isStockMovementType = (value: string): value is StockMovementType =>
  (STOCK_MOVEMENT_TYPES as readonly string[]).includes(value)

type DbRow = {
  id: number
  created_at: string
  product_id: number | null
  product_sku: string
  product_name: string
  type: string
  delta: number
  stock_after: number
  reason: string
  order_id: number | null
  actor_type: string
  actor_admin_id: number | null
  actor_label: string | null
}

const mapRow = (row: DbRow): CrmStockMovementRow => ({
  id: row.id,
  createdAt: row.created_at,
  productId: row.product_id,
  productSku: row.product_sku,
  productName: row.product_name,
  type: row.type as StockMovementType,
  delta: Number(row.delta),
  stockAfter: Number(row.stock_after),
  reason: row.reason,
  orderId: row.order_id,
  actorType: row.actor_type as StockActorType,
  actorAdminId: row.actor_admin_id,
  actorLabel: row.actor_label,
})

const buildWhere = (filters: CrmStockMovementsFilters) => {
  const where: string[] = []
  const params: unknown[] = []

  const q = filters.q?.trim()
  if (q) {
    params.push(`%${q}%`)
    where.push(`(product_sku ILIKE $${params.length} OR product_name ILIKE $${params.length})`)
  }

  if (filters.type?.trim()) {
    const type = filters.type.trim()
    if (!isStockMovementType(type)) {
      throw new CrmStockValidationError(`Некорректный тип движения: ${type}`)
    }
    params.push(type)
    where.push(`type = $${params.length}`)
  }

  if (filters.dateFrom?.trim()) {
    params.push(filters.dateFrom.trim())
    where.push(`created_at::date >= $${params.length}::date`)
  }

  if (filters.dateTo?.trim()) {
    params.push(filters.dateTo.trim())
    where.push(`created_at::date <= $${params.length}::date`)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  return { whereSql, params }
}

export const listStockMovements = async (
  filters: CrmStockMovementsFilters = {},
): Promise<CrmStockMovementsListResult> => {
  const page = normalizeAdminOrdersPage(filters.page)
  const pageSize = normalizeAdminOrdersPageSize(filters.pageSize)
  const offset = (page - 1) * pageSize

  const { whereSql, params } = buildWhere(filters)

  const countRes = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM stock_movements ${whereSql}`,
    params,
  )
  const total = Number(countRes.rows[0]?.total ?? 0)

  const limitIdx = params.length + 1
  const offsetIdx = params.length + 2
  const listParams = [...params, pageSize, offset]

  const listRes = await pool.query<DbRow>(
    `SELECT id,
            created_at::text,
            product_id,
            product_sku,
            product_name,
            type,
            delta,
            stock_after,
            reason,
            order_id,
            actor_type,
            actor_admin_id,
            actor_label
     FROM stock_movements
     ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  )

  return {
    rows: listRes.rows.map(mapRow),
    total,
    page,
    pageSize,
  }
}
