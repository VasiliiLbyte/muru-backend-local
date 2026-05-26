import {
  isValidOrderStatus,
  ORDER_STATUS_CANCELLED,
} from '../constants/order-statuses'
import type { DeliveryMode, OrderDraft, OrderItemInput } from '../types/order'
import { pool } from '../utils/db'

import { normalizeAdminOrdersPage, normalizeAdminOrdersPageSize } from './admin-orders.helpers'

export {
  normalizeAdminOrdersPage,
  normalizeAdminOrdersPageSize,
  shouldNotifyConfirmed,
} from './admin-orders.helpers'

export type AdminOrderListItem = {
  id: number
  telegramUserId: number
  status: string
  total: number
  deliveryMode: DeliveryMode
  address: string
  createdAt: string
  itemsCount: number
  customerName: string | null
  customerPhone: string | null
}

export type AdminOrderDetailItem = OrderItemInput & {
  imageUrl: string | null
}

export type AdminOrderDetail = AdminOrderListItem & {
  items: AdminOrderDetailItem[]
  comment: string
  adminComment: string
  deliveryOption: string | null
  deliveryPrice: number
  deliveryEta: string | null
  subtotal: number
  promoCode: string | null
  promoDiscount: number
  cdekSyncState: string
  cdekUuid: string | null
  cdekTrackNumber: string | null
  cdekStatus: string | null
  cdekStatusUpdatedAt: string | null
  cdekCreateError: string | null
}

export type AdminOrdersListFilters = {
  status?: string
  q?: string
  dateFrom?: string
  dateTo?: string
  page?: unknown
  pageSize?: unknown
}

export type AdminOrdersListResult = {
  items: AdminOrderListItem[]
  total: number
  page: number
  pageSize: number
  statusCounts: Record<string, number>
}

export type AdminOrderPatch = {
  status?: string
  adminComment?: string
  deliveryEta?: string | null
}

const toNumber = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return value
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

type FilterBuildResult = {
  where: string[]
  params: unknown[]
}

const buildListFilters = (filters: AdminOrdersListFilters, includeStatus: boolean): FilterBuildResult => {
  const where: string[] = []
  const params: unknown[] = []

  if (includeStatus && filters.status?.trim()) {
    if (filters.status.trim() === 'Черновик') {
      where.push('o.is_draft = TRUE')
    } else {
      where.push('o.is_draft = FALSE')
      params.push(filters.status.trim())
      where.push(`o.status = $${params.length}`)
    }
  } else {
    where.push('o.is_draft = FALSE')
  }

  const q = filters.q?.trim()
  if (q) {
    params.push(`%${q}%`)
    const idx = params.length
    where.push(
      `(o.id::text ILIKE $${idx} OR o.address ILIKE $${idx} OR up.phone ILIKE $${idx} OR up.full_name ILIKE $${idx})`,
    )
  }

  if (filters.dateFrom?.trim()) {
    params.push(filters.dateFrom.trim())
    where.push(`o.created_at::date >= $${params.length}::date`)
  }

  if (filters.dateTo?.trim()) {
    params.push(filters.dateTo.trim())
    where.push(`o.created_at::date <= $${params.length}::date`)
  }

  return { where, params }
}

const mapListRow = (row: {
  id: number
  telegram_user_id: string
  status: string
  total: string
  delivery_mode: DeliveryMode
  address: string
  created_at: string
  items_count: string
  customer_name: string | null
  customer_phone: string | null
}): AdminOrderListItem => ({
  id: row.id,
  telegramUserId: Number(row.telegram_user_id),
  status: row.status,
  total: toNumber(row.total),
  deliveryMode: row.delivery_mode,
  address: row.address,
  createdAt: row.created_at,
  itemsCount: Number(row.items_count),
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
})

const pickProductImageUrl = (imageUrl1: string | null, imageUrlsRaw: unknown): string | null => {
  if (imageUrl1?.trim()) return imageUrl1
  if (Array.isArray(imageUrlsRaw) && typeof imageUrlsRaw[0] === 'string') {
    return imageUrlsRaw[0]
  }
  return null
}

export const listAdminOrders = async (filters: AdminOrdersListFilters): Promise<AdminOrdersListResult> => {
  const page = normalizeAdminOrdersPage(filters.page)
  const pageSize = normalizeAdminOrdersPageSize(filters.pageSize)
  const offset = (page - 1) * pageSize

  const listFilters = buildListFilters(filters, true)
  const countFilters = buildListFilters(filters, true)
  const statusCountFilters = buildListFilters(filters, false)

  const listWhere = listFilters.where.length > 0 ? `WHERE ${listFilters.where.join(' AND ')}` : ''
  const countWhere = countFilters.where.length > 0 ? `WHERE ${countFilters.where.join(' AND ')}` : ''
  const statusCountWhere =
    statusCountFilters.where.length > 0 ? `WHERE ${statusCountFilters.where.join(' AND ')}` : ''

  const fromJoin = `
    FROM orders o
    LEFT JOIN user_profiles up ON up.telegram_user_id = o.telegram_user_id
  `

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(DISTINCT o.id)::text AS total ${fromJoin} ${countWhere}`,
    countFilters.params,
  )
  const total = Number(countResult.rows[0]?.total ?? 0)

  const listParams = [...listFilters.params, pageSize, offset]
  const limitIdx = listFilters.params.length + 1
  const offsetIdx = listFilters.params.length + 2

  const listResult = await pool.query<{
    id: number
    telegram_user_id: string
    status: string
    total: string
    delivery_mode: DeliveryMode
    address: string
    created_at: string
    items_count: string
    customer_name: string | null
    customer_phone: string | null
  }>(
    `SELECT
       o.id,
       o.telegram_user_id::text,
       o.status,
       o.total::text,
       o.delivery_mode,
       o.address,
       o.created_at::text,
       COUNT(oi.id)::text AS items_count,
       up.full_name AS customer_name,
       up.phone AS customer_phone
     ${fromJoin}
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${listWhere}
     GROUP BY o.id, up.full_name, up.phone
     ORDER BY o.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  )

  const statusCountsResult = await pool.query<{ status: string; count: string }>(
    `SELECT o.status, COUNT(*)::text AS count
     FROM orders o
     LEFT JOIN user_profiles up ON up.telegram_user_id = o.telegram_user_id
     ${statusCountWhere}
     GROUP BY o.status`,
    statusCountFilters.params,
  )

  const statusCounts: Record<string, number> = {}
  for (const row of statusCountsResult.rows) {
    statusCounts[row.status] = Number(row.count)
  }

  return {
    items: listResult.rows.map(mapListRow),
    total,
    page,
    pageSize,
    statusCounts,
  }
}

const fetchOrderItemsWithImages = async (orderId: number): Promise<AdminOrderDetailItem[]> => {
  const result = await pool.query<{
    product_sku: string
    product_name: string
    price: string
    quantity: number
    color: string | null
    size: string | null
    image_url_1: string | null
    image_urls: unknown
  }>(
    `SELECT
       oi.product_sku,
       oi.product_name,
       oi.price::text,
       oi.quantity,
       oi.color,
       oi.size,
       p.image_url_1,
       p.image_urls
     FROM order_items oi
     LEFT JOIN products p ON p.sku = oi.product_sku
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [orderId],
  )

  return result.rows.map((row) => ({
    sku: row.product_sku,
    name: row.product_name,
    price: toNumber(row.price),
    quantity: row.quantity,
    color: row.color ?? undefined,
    size: row.size ?? undefined,
    imageUrl: pickProductImageUrl(row.image_url_1, row.image_urls),
  }))
}

export const getAdminOrderById = async (orderId: number): Promise<AdminOrderDetail | null> => {
  const orderResult = await pool.query<{
    id: number
    telegram_user_id: string
    status: string
    total: string
    subtotal: string
    delivery_mode: DeliveryMode
    delivery_option: string | null
    delivery_price: string
    delivery_eta: string | null
    address: string
    comment: string
    admin_comment: string
    promo_code: string | null
    promo_discount: string
    created_at: string
    customer_name: string | null
    customer_phone: string | null
    cdek_sync_state: string
    cdek_uuid: string | null
    cdek_track_number: string | null
    cdek_status: string | null
    cdek_status_updated_at: string | null
    cdek_create_error: string | null
  }>(
    `SELECT
       o.id,
       o.telegram_user_id::text,
       o.status,
       o.total::text,
       o.subtotal::text,
       o.delivery_mode,
       o.delivery_option,
       o.delivery_price::text,
       o.delivery_eta,
       o.address,
       o.comment,
       o.admin_comment,
       o.promo_code,
       o.promo_discount::text,
       o.created_at::text,
       o.cdek_sync_state,
       o.cdek_uuid,
       o.cdek_track_number,
       o.cdek_status,
       o.cdek_status_updated_at::text,
       o.cdek_create_error,
       up.full_name AS customer_name,
       up.phone AS customer_phone
     FROM orders o
     LEFT JOIN user_profiles up ON up.telegram_user_id = o.telegram_user_id
     WHERE o.id = $1`,
    [orderId],
  )

  if (orderResult.rows.length === 0) return null

  const row = orderResult.rows[0]
  const items = await fetchOrderItemsWithImages(orderId)

  return {
    id: row.id,
    telegramUserId: Number(row.telegram_user_id),
    status: row.status,
    total: toNumber(row.total),
    subtotal: toNumber(row.subtotal),
    deliveryMode: row.delivery_mode,
    deliveryOption: row.delivery_option,
    deliveryPrice: toNumber(row.delivery_price),
    deliveryEta: row.delivery_eta,
    address: row.address,
    comment: row.comment,
    adminComment: row.admin_comment,
    createdAt: row.created_at,
    itemsCount: items.length,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    promoCode: row.promo_code,
    promoDiscount: toNumber(row.promo_discount),
    cdekSyncState: row.cdek_sync_state,
    cdekUuid: row.cdek_uuid,
    cdekTrackNumber: row.cdek_track_number,
    cdekStatus: row.cdek_status,
    cdekStatusUpdatedAt: row.cdek_status_updated_at,
    cdekCreateError: row.cdek_create_error,
    items,
  }
}

const toOrderDraft = (detail: AdminOrderDetail): OrderDraft => ({
  id: detail.id,
  telegramUserId: detail.telegramUserId,
  status: detail.status,
  deliveryMode: detail.deliveryMode,
  deliveryOption: detail.deliveryOption,
  deliveryPrice: detail.deliveryPrice,
  deliveryEta: detail.deliveryEta,
  address: detail.address,
  comment: detail.comment,
  birthDate: null,
  subtotal: detail.subtotal,
  total: detail.total,
  items: detail.items.map(({ sku, name, price, quantity, color, size }) => ({
    sku,
    name,
    price,
    quantity,
    color,
    size,
  })),
})

export const updateAdminOrder = async (
  orderId: number,
  patch: AdminOrderPatch,
  managerTelegramId?: number,
): Promise<{ order: AdminOrderDetail; previousStatus: string } | null> => {
  const existing = await pool.query<{ status: string }>(
    `SELECT status FROM orders WHERE id = $1`,
    [orderId],
  )
  if (existing.rows.length === 0) return null

  const previousStatus = existing.rows[0].status

  if (patch.status !== undefined && !isValidOrderStatus(patch.status)) {
    throw new Error(`Invalid order status: ${patch.status}`)
  }

  const sets: string[] = ['updated_at = NOW()']
  const params: unknown[] = []

  if (patch.status !== undefined) {
    params.push(patch.status)
    sets.push(`status = $${params.length}`)
    if (patch.status === 'Черновик') {
      sets.push('is_draft = TRUE')
    } else if (patch.status) {
      sets.push('is_draft = FALSE')
    }
  }

  if (patch.adminComment !== undefined) {
    params.push(patch.adminComment)
    sets.push(`admin_comment = $${params.length}`)
  }

  if (patch.deliveryEta !== undefined) {
    params.push(patch.deliveryEta)
    sets.push(`delivery_eta = $${params.length}`)
  }

  if (managerTelegramId !== undefined) {
    params.push(managerTelegramId)
    sets.push(`manager_telegram_id = $${params.length}`)
  }

  params.push(orderId)
  await pool.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = $${params.length}`, params)

  const order = await getAdminOrderById(orderId)
  if (!order) return null

  return { order, previousStatus }
}

export const restockAdminOrder = async (orderId: number): Promise<AdminOrderDetail> => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const orderResult = await client.query<{ status: string }>(
      `SELECT status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    )
    if (orderResult.rows.length === 0) {
      throw new Error('Order not found')
    }

    if (orderResult.rows[0].status === ORDER_STATUS_CANCELLED) {
      const err = new Error('Order is already cancelled')
      ;(err as Error & { statusCode?: number }).statusCode = 409
      throw err
    }

    const itemsResult = await client.query<{ product_sku: string; quantity: number }>(
      `SELECT product_sku, quantity FROM order_items WHERE order_id = $1`,
      [orderId],
    )

    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE products SET in_stock = in_stock + $1 WHERE sku = $2`,
        [item.quantity, item.product_sku],
      )
    }

    await client.query(
      `UPDATE orders SET status = $1, is_draft = FALSE, updated_at = NOW() WHERE id = $2`,
      [ORDER_STATUS_CANCELLED, orderId],
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  const order = await getAdminOrderById(orderId)
  if (!order) throw new Error('Order not found after restock')
  return order
}

export const adminOrderDetailToOrderDraft = toOrderDraft
