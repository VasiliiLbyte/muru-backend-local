import {
  isValidOrderStatus,
  ORDER_STATUS_CANCELLED,
} from '../constants/order-statuses'
import type { DeliveryMode, OrderChannel, OrderDraft, OrderItemInput } from '../types/order'
import { pool } from '../utils/db'

import { normalizeAdminOrdersPage, normalizeAdminOrdersPageSize } from './admin-orders.helpers'

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

export type CrmOrderDetailItem = OrderItemInput & {
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

export type CrmOrdersListFilters = {
  channel?: OrderChannel
  status?: string
  q?: string
  dateFrom?: string
  dateTo?: string
  page?: unknown
  pageSize?: unknown
}

export type CrmOrdersListResult = {
  items: CrmOrderListItem[]
  total: number
  page: number
  pageSize: number
  statusCounts: Record<string, number>
}

export type CrmOrderPatch = {
  status?: string
  adminComment?: string
  deliveryEta?: string | null
}

const CUSTOMER_NAME_SQL = `CASE WHEN o.channel = 'web' THEN o.cdek_recipient_name ELSE up.full_name END`
const CUSTOMER_PHONE_SQL = `CASE WHEN o.channel = 'web' THEN o.cdek_recipient_phone ELSE up.phone END`

const toNumber = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return value
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const mapTelegramUserId = (raw: string | null): number | null =>
  raw != null ? Number(raw) : null

type FilterBuildResult = {
  where: string[]
  params: unknown[]
}

const buildListFilters = (filters: CrmOrdersListFilters, includeStatus: boolean): FilterBuildResult => {
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

  if (filters.channel) {
    params.push(filters.channel)
    where.push(`o.channel = $${params.length}`)
  }

  const q = filters.q?.trim()
  if (q) {
    params.push(`%${q}%`)
    const idx = params.length
    where.push(
      `(o.id::text ILIKE $${idx} OR o.address ILIKE $${idx} OR up.phone ILIKE $${idx} OR up.full_name ILIKE $${idx} OR o.cdek_recipient_name ILIKE $${idx} OR o.cdek_recipient_phone ILIKE $${idx} OR (o.telegram_user_id IS NOT NULL AND o.telegram_user_id::text ILIKE $${idx}))`,
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

const pickProductImageUrl = (imageUrl1: string | null, imageUrlsRaw: unknown): string | null => {
  if (imageUrl1?.trim()) return imageUrl1
  if (Array.isArray(imageUrlsRaw) && typeof imageUrlsRaw[0] === 'string') {
    return imageUrlsRaw[0]
  }
  return null
}

const mapListRow = (row: {
  id: number
  channel: OrderChannel
  telegram_user_id: string | null
  status: string
  total: string
  delivery_mode: DeliveryMode
  created_at: string
  items_count: string
  customer_name: string | null
  customer_phone: string | null
  payment_status: string | null
  paid_at: string | null
}): CrmOrderListItem => ({
  id: row.id,
  channel: row.channel,
  telegramUserId: mapTelegramUserId(row.telegram_user_id),
  status: row.status,
  total: toNumber(row.total),
  deliveryMode: row.delivery_mode,
  createdAt: row.created_at,
  itemsCount: Number(row.items_count),
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  paymentStatus: row.payment_status,
  paidAt: row.paid_at,
})

const FROM_JOIN = `
  FROM orders o
  LEFT JOIN user_profiles up ON up.telegram_user_id = o.telegram_user_id
`

export const listCrmOrders = async (filters: CrmOrdersListFilters): Promise<CrmOrdersListResult> => {
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

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(DISTINCT o.id)::text AS total ${FROM_JOIN} ${countWhere}`,
    countFilters.params,
  )
  const total = Number(countResult.rows[0]?.total ?? 0)

  const listParams = [...listFilters.params, pageSize, offset]
  const limitIdx = listFilters.params.length + 1
  const offsetIdx = listFilters.params.length + 2

  const listResult = await pool.query<{
    id: number
    channel: OrderChannel
    telegram_user_id: string | null
    status: string
    total: string
    delivery_mode: DeliveryMode
    created_at: string
    items_count: string
    customer_name: string | null
    customer_phone: string | null
    payment_status: string | null
    paid_at: string | null
  }>(
    `SELECT
       o.id,
       o.channel,
       o.telegram_user_id::text,
       o.status,
       o.total::text,
       o.delivery_mode,
       o.created_at::text,
       COUNT(oi.id)::text AS items_count,
       ${CUSTOMER_NAME_SQL} AS customer_name,
       ${CUSTOMER_PHONE_SQL} AS customer_phone,
       o.payment_status,
       o.paid_at::text
     ${FROM_JOIN}
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${listWhere}
     GROUP BY o.id, o.channel, o.telegram_user_id, o.status, o.total, o.delivery_mode,
              o.created_at, o.payment_status, o.paid_at,
              o.cdek_recipient_name, o.cdek_recipient_phone, up.full_name, up.phone
     ORDER BY o.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  )

  const statusCountsResult = await pool.query<{ status: string; count: string }>(
    `SELECT o.status, COUNT(*)::text AS count
     ${FROM_JOIN}
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

const fetchOrderItemsWithImages = async (orderId: number): Promise<CrmOrderDetailItem[]> => {
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

export const getCrmOrderById = async (orderId: number): Promise<CrmOrderDetail | null> => {
  const orderResult = await pool.query<{
    id: number
    channel: OrderChannel
    telegram_user_id: string | null
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
    updated_at: string
    customer_name: string | null
    customer_phone: string | null
    payment_id: string | null
    payment_status: string | null
    paid_at: string | null
    consent_accepted: boolean
    consent_version: string | null
    consent_accepted_at: string | null
    cdek_tariff_code: number | null
    cdek_to_city_code: number | null
    cdek_to_city_name: string | null
    cdek_pvz_code: string | null
    cdek_pvz_address: string | null
    cdek_recipient_name: string | null
    cdek_recipient_phone: string | null
    cdek_sync_state: string
    cdek_uuid: string | null
    cdek_track_number: string | null
    cdek_status: string | null
    cdek_status_updated_at: string | null
    cdek_create_error: string | null
  }>(
    `SELECT
       o.id,
       o.channel,
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
       o.updated_at::text,
       ${CUSTOMER_NAME_SQL} AS customer_name,
       ${CUSTOMER_PHONE_SQL} AS customer_phone,
       o.payment_id,
       o.payment_status,
       o.paid_at::text,
       o.consent_accepted,
       o.consent_version,
       o.consent_accepted_at::text,
       o.cdek_tariff_code,
       o.cdek_to_city_code,
       o.cdek_to_city_name,
       o.cdek_pvz_code,
       o.cdek_pvz_address,
       o.cdek_recipient_name,
       o.cdek_recipient_phone,
       o.cdek_sync_state,
       o.cdek_uuid,
       o.cdek_track_number,
       o.cdek_status,
       o.cdek_status_updated_at::text,
       o.cdek_create_error
     ${FROM_JOIN}
     WHERE o.id = $1`,
    [orderId],
  )

  if (orderResult.rows.length === 0) return null

  const row = orderResult.rows[0]
  const items = await fetchOrderItemsWithImages(orderId)

  return {
    id: row.id,
    channel: row.channel,
    telegramUserId: mapTelegramUserId(row.telegram_user_id),
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
    updatedAt: row.updated_at,
    itemsCount: items.length,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    paymentStatus: row.payment_status,
    paidAt: row.paid_at,
    paymentId: row.payment_id,
    promoCode: row.promo_code,
    promoDiscount: toNumber(row.promo_discount),
    consentAccepted: row.consent_accepted,
    consentVersion: row.consent_version,
    consentAcceptedAt: row.consent_accepted_at,
    cdekTariffCode: row.cdek_tariff_code,
    cdekCityCode: row.cdek_to_city_code,
    cdekCityName: row.cdek_to_city_name,
    cdekPvzCode: row.cdek_pvz_code,
    cdekPvzAddress: row.cdek_pvz_address,
    cdekRecipientName: row.cdek_recipient_name,
    cdekRecipientPhone: row.cdek_recipient_phone,
    cdekSyncState: row.cdek_sync_state,
    cdekUuid: row.cdek_uuid,
    cdekTrackNumber: row.cdek_track_number,
    cdekStatus: row.cdek_status,
    cdekStatusUpdatedAt: row.cdek_status_updated_at,
    cdekCreateError: row.cdek_create_error,
    items,
  }
}

export const crmOrderDetailToOrderDraft = (detail: CrmOrderDetail): OrderDraft => ({
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
  promoCode: detail.promoCode,
  promoDiscount: detail.promoDiscount,
  cdekTariffCode: detail.cdekTariffCode,
  cdekCityCode: detail.cdekCityCode,
  cdekCityName: detail.cdekCityName,
  cdekPvzCode: detail.cdekPvzCode,
  cdekPvzAddress: detail.cdekPvzAddress,
  recipientName: detail.cdekRecipientName,
  recipientPhone: detail.cdekRecipientPhone,
  items: detail.items.map(({ sku, name, price, quantity, color, size }) => ({
    sku,
    name,
    price,
    quantity,
    color,
    size,
  })),
})

export const updateCrmOrder = async (
  orderId: number,
  patch: CrmOrderPatch,
): Promise<{ order: CrmOrderDetail; previousStatus: string } | null> => {
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

  params.push(orderId)
  await pool.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = $${params.length}`, params)

  const order = await getCrmOrderById(orderId)
  if (!order) return null

  return { order, previousStatus }
}

export const cancelCrmOrder = async (orderId: number): Promise<CrmOrderDetail> => {
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

  const order = await getCrmOrderById(orderId)
  if (!order) throw new Error('Order not found after cancel')
  return order
}
