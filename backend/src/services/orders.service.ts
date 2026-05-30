import type { PoolClient } from 'pg'

import {
  applyPromoCodeOnOrder,
  validatePromoCode,
  PromoValidationError,
} from './promo.service'
import { pool } from '../utils/db'
import type { CheckoutDraftInput, OrderDraft, OrderHistoryItem, OrderItemInput } from '../types/order'

const normalizeMoney = (value: number | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Number(value.toFixed(2)))
}

const calculateSubtotal = (items: OrderItemInput[]) =>
  items.reduce((acc, item) => acc + item.price * item.quantity, 0)

type OrderRowForDraft = {
  id: number
  telegram_user_id: string
  status: string
  delivery_mode: 'delivery' | 'pickup'
  delivery_option: string | null
  delivery_price: string
  delivery_eta: string | null
  address: string
  comment: string
  birth_date: string | null
  subtotal: string
  total: string
  promo_code: string | null
  promo_discount: string
  cdek_tariff_code: number | null
  cdek_to_city_code: number | null
  cdek_to_city_name: string | null
  cdek_pvz_code: string | null
  cdek_pvz_address: string | null
  cdek_recipient_name: string | null
  cdek_recipient_phone: string | null
}

const cdekDraftSqlParams = (input: CheckoutDraftInput) => [
  input.cdekTariffCode ?? null,
  input.cdekCityCode ?? null,
  input.cdekCityName ?? null,
  input.cdekPvzCode ?? null,
  input.cdekPvzAddress ?? null,
  input.recipientName ?? null,
  input.recipientPhone ?? null,
]

const mapOrderDraft = (
  orderRow: OrderRowForDraft,
  items: Array<{
    product_sku: string
    product_name: string
    price: string
    quantity: number
    color: string | null
    size: string | null
  }>,
): OrderDraft => ({
  id: orderRow.id,
  telegramUserId: Number(orderRow.telegram_user_id),
  status: orderRow.status,
  deliveryMode: orderRow.delivery_mode,
  deliveryOption: orderRow.delivery_option,
  deliveryPrice: Number(orderRow.delivery_price),
  deliveryEta: orderRow.delivery_eta,
  address: orderRow.address,
  comment: orderRow.comment,
  birthDate: orderRow.birth_date,
  subtotal: Number(orderRow.subtotal),
  total: Number(orderRow.total),
  promoCode: orderRow.promo_code,
  promoDiscount: Number(orderRow.promo_discount),
  cdekTariffCode: orderRow.cdek_tariff_code,
  cdekCityCode: orderRow.cdek_to_city_code,
  cdekCityName: orderRow.cdek_to_city_name,
  cdekPvzCode: orderRow.cdek_pvz_code,
  cdekPvzAddress: orderRow.cdek_pvz_address,
  recipientName: orderRow.cdek_recipient_name,
  recipientPhone: orderRow.cdek_recipient_phone,
  items: items.map((item) => ({
    sku: item.product_sku,
    name: item.product_name,
    price: Number(item.price),
    quantity: item.quantity,
    color: item.color ?? undefined,
    size: item.size ?? undefined,
  })),
})

const replaceOrderItems = async (client: PoolClient, orderId: number, items: OrderItemInput[]) => {
  await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId])
  for (const item of items) {
    await client.query(
      `INSERT INTO order_items (order_id, product_sku, product_name, price, quantity, color, size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orderId, item.sku, item.name, item.price, item.quantity, item.color ?? null, item.size ?? null],
    )
  }
}

export const getDraftOrderByTelegramUserId = async (
  telegramUserId: number,
): Promise<OrderDraft | null> => {
  const orderResult = await pool.query<OrderRowForDraft>(
    `SELECT id, telegram_user_id, status, delivery_mode, delivery_option, delivery_price::text,
            delivery_eta, address, comment, birth_date::text, subtotal::text, total::text,
            promo_code, promo_discount::text,
            cdek_tariff_code, cdek_to_city_code, cdek_to_city_name,
            cdek_pvz_code, cdek_pvz_address, cdek_recipient_name, cdek_recipient_phone
     FROM orders
     WHERE telegram_user_id = $1 AND is_draft = TRUE
     ORDER BY updated_at DESC
     LIMIT 1`,
    [telegramUserId],
  )
  const order = orderResult.rows[0]
  if (!order) return null

  const itemsResult = await pool.query<{
    product_sku: string
    product_name: string
    price: string
    quantity: number
    color: string | null
    size: string | null
  }>(
    `SELECT product_sku, product_name, price::text, quantity, color, size
     FROM order_items
     WHERE order_id = $1`,
    [order.id],
  )

  return mapOrderDraft(order, itemsResult.rows)
}

export const saveDraftOrder = async (input: CheckoutDraftInput): Promise<OrderDraft> => {
  const subtotal = normalizeMoney(calculateSubtotal(input.items))
  const deliveryPrice = input.deliveryMode === 'pickup' ? 0 : normalizeMoney(input.deliveryPrice)
  const total = normalizeMoney(subtotal + deliveryPrice)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const existingDraft = await client.query<{ id: number }>(
      `SELECT id FROM orders WHERE telegram_user_id = $1 AND is_draft = TRUE ORDER BY updated_at DESC LIMIT 1`,
      [input.telegramUserId],
    )

    let orderId: number
    if (existingDraft.rows[0]) {
      orderId = existingDraft.rows[0].id
      await client.query(
        `UPDATE orders
         SET delivery_mode = $2,
             delivery_option = $3,
             delivery_price = $4,
             delivery_eta = $5,
             address = $6,
             comment = $7,
             birth_date = $8,
             subtotal = $9,
             total = $10,
             cdek_tariff_code = $11,
             cdek_to_city_code = $12,
             cdek_to_city_name = $13,
             cdek_pvz_code = $14,
             cdek_pvz_address = $15,
             cdek_recipient_name = $16,
             cdek_recipient_phone = $17,
             updated_at = NOW()
         WHERE id = $1`,
        [
          orderId,
          input.deliveryMode,
          input.deliveryOption ?? null,
          deliveryPrice,
          input.deliveryEta ?? null,
          input.address ?? '',
          input.comment ?? '',
          input.birthDate ?? null,
          subtotal,
          total,
          ...cdekDraftSqlParams(input),
        ],
      )
    } else {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO orders (
          telegram_user_id, status, delivery_mode, delivery_option, delivery_price, delivery_eta,
          address, comment, birth_date, subtotal, total,
          cdek_tariff_code, cdek_to_city_code, cdek_to_city_name, cdek_pvz_code, cdek_pvz_address,
          cdek_recipient_name, cdek_recipient_phone,
          is_draft, created_at, updated_at
        ) VALUES ($1, 'Черновик', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, TRUE, NOW(), NOW())
        RETURNING id`,
        [
          input.telegramUserId,
          input.deliveryMode,
          input.deliveryOption ?? null,
          deliveryPrice,
          input.deliveryEta ?? null,
          input.address ?? '',
          input.comment ?? '',
          input.birthDate ?? null,
          subtotal,
          total,
          ...cdekDraftSqlParams(input),
        ],
      )
      orderId = inserted.rows[0].id
    }

    await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId])
    for (const item of input.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_sku, product_name, price, quantity, color, size)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, item.sku, item.name, item.price, item.quantity, item.color ?? null, item.size ?? null],
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  const saved = await getDraftOrderByTelegramUserId(input.telegramUserId)
  if (!saved) throw new Error('Failed to save draft order')
  return saved
}

export const createOrder = async (input: CheckoutDraftInput): Promise<OrderDraft> => {
  const subtotal = normalizeMoney(calculateSubtotal(input.items))
  const deliveryPrice = input.deliveryMode === 'pickup' ? 0 : normalizeMoney(input.deliveryPrice)

  let promoDiscount = 0
  let promoCodeStored: string | null = null
  let promoCodeId: number | null = null

  if (input.promoCode?.trim()) {
    const validation = await validatePromoCode({
      code: input.promoCode,
      telegramUserId: input.telegramUserId,
      subtotal,
    })
    if (!validation.valid) {
      throw new PromoValidationError(validation.reason)
    }
    promoDiscount = validation.discountValue
    promoCodeStored = validation.code
    promoCodeId = validation.promoCodeId
  }

  const total = normalizeMoney(Math.max(0, subtotal - promoDiscount + deliveryPrice))
  const client = await pool.connect()
  let createdOrderId: number | null = null

  try {
    await client.query('BEGIN')
    const consentAccepted = input.consentAccepted === true
    const inserted = await client.query<OrderRowForDraft>(
      `INSERT INTO orders (
        telegram_user_id, status, delivery_mode, delivery_option, delivery_price, delivery_eta,
        address, comment, birth_date, subtotal, total, promo_code, promo_discount,
        cdek_tariff_code, cdek_to_city_code, cdek_to_city_name, cdek_pvz_code, cdek_pvz_address,
        cdek_recipient_name, cdek_recipient_phone,
        consent_accepted, consent_version, consent_accepted_at,
        is_draft, created_at, updated_at
      ) VALUES ($1, 'Новый', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CASE WHEN $20 THEN NOW() ELSE NULL END, FALSE, NOW(), NOW())
      RETURNING id, telegram_user_id, status, delivery_mode, delivery_option, delivery_price::text,
                delivery_eta, address, comment, birth_date::text, subtotal::text, total::text,
                promo_code, promo_discount::text,
                cdek_tariff_code, cdek_to_city_code, cdek_to_city_name,
                cdek_pvz_code, cdek_pvz_address, cdek_recipient_name, cdek_recipient_phone`,
      [
        input.telegramUserId,
        input.deliveryMode,
        input.deliveryOption ?? null,
        deliveryPrice,
        input.deliveryEta ?? null,
        input.address ?? '',
        input.comment ?? '',
        input.birthDate ?? null,
        subtotal,
        total,
        promoCodeStored,
        promoDiscount,
        input.cdekTariffCode ?? null,
        input.cdekCityCode ?? null,
        input.cdekCityName ?? null,
        input.cdekPvzCode ?? null,
        input.cdekPvzAddress ?? null,
        input.recipientName ?? null,
        input.recipientPhone ?? null,
        consentAccepted,
        input.consentVersion ?? null,
      ],
    )
    const order = inserted.rows[0]
    createdOrderId = order.id
    await replaceOrderItems(client, order.id, input.items)
    for (const item of input.items) {
      await client.query(
        `UPDATE products SET in_stock = GREATEST(0, in_stock - $1) WHERE sku = $2`,
        [item.quantity, item.sku],
      )
    }
    await client.query(
      `UPDATE orders SET is_draft = FALSE, updated_at = NOW()
       WHERE telegram_user_id = $1 AND is_draft = TRUE`,
      [input.telegramUserId],
    )
    await client.query('COMMIT')

    if (promoCodeId != null && createdOrderId != null) {
      const usageClient = await pool.connect()
      try {
        await usageClient.query('BEGIN')
        await applyPromoCodeOnOrder(usageClient, {
          promoCodeId,
          telegramUserId: input.telegramUserId,
          orderId: createdOrderId,
        })
        await usageClient.query('COMMIT')
      } catch (error) {
        await usageClient.query('ROLLBACK')
        throw error
      } finally {
        usageClient.release()
      }
    }

    const itemsResult = await pool.query<{
      product_sku: string
      product_name: string
      price: string
      quantity: number
      color: string | null
      size: string | null
    }>(
      `SELECT product_sku, product_name, price::text, quantity, color, size
       FROM order_items
       WHERE order_id = $1`,
      [order.id],
    )

    if (input.cdekTariffCode && input.cdekCityCode) {
      await pool.query(`UPDATE orders SET cdek_sync_state = 'pending' WHERE id = $1`, [order.id])
      void (async () => {
        try {
          const { createCdekOrder } = await import('./cdek/orders.service')
          await createCdekOrder(order.id)
        } catch {
          // logged inside createCdekOrder
        }
      })()
    }

    return mapOrderDraft(order, itemsResult.rows)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const getOrdersByTelegramUserId = async (telegramUserId: number): Promise<OrderHistoryItem[]> => {
  const ordersResult = await pool.query<{
    id: number
    created_at: string
    status: string
    total: string
    promo_code: string | null
    promo_discount: string
    delivery_mode: 'delivery' | 'pickup'
    delivery_option: string | null
    delivery_price: string
    delivery_eta: string | null
    address: string
    subtotal: string
    cdek_pvz_address: string | null
    cdek_recipient_name: string | null
    cdek_recipient_phone: string | null
    cdek_track_number: string | null
    cdek_status: string | null
  }>(
    `SELECT id, created_at::text, status, total::text, promo_code, promo_discount::text,
            delivery_mode, delivery_option, delivery_price::text, delivery_eta, address, subtotal::text,
            cdek_pvz_address, cdek_recipient_name, cdek_recipient_phone, cdek_track_number, cdek_status
     FROM orders
     WHERE telegram_user_id = $1
     ORDER BY created_at DESC`,
    [telegramUserId],
  )

  if (ordersResult.rows.length === 0) return []

  const itemsResult = await pool.query<{
    order_id: number
    product_sku: string
    product_name: string
    price: string
    quantity: number
    color: string | null
    size: string | null
  }>(
    `SELECT order_id, product_sku, product_name, price::text, quantity, color, size
     FROM order_items
     WHERE order_id = ANY($1::int[])`,
    [ordersResult.rows.map((row) => row.id)],
  )

  const itemMap = new Map<number, OrderItemInput[]>()
  for (const row of itemsResult.rows) {
    const list = itemMap.get(row.order_id) ?? []
    list.push({
      sku: row.product_sku,
      name: row.product_name,
      price: Number(row.price),
      quantity: row.quantity,
      color: row.color ?? undefined,
      size: row.size ?? undefined,
    })
    itemMap.set(row.order_id, list)
  }

  return ordersResult.rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    total: Number(row.total),
    promoCode: row.promo_code,
    promoDiscount: Number(row.promo_discount),
    items: itemMap.get(row.id) ?? [],
    deliveryMode: row.delivery_mode,
    deliveryOption: row.delivery_option,
    deliveryPrice: Number(row.delivery_price),
    deliveryEta: row.delivery_eta,
    address: row.address,
    subtotal: Number(row.subtotal),
    cdekPvzAddress: row.cdek_pvz_address,
    cdekRecipientName: row.cdek_recipient_name,
    cdekRecipientPhone: row.cdek_recipient_phone,
    cdekTrackNumber: row.cdek_track_number,
    cdekStatus: row.cdek_status,
  }))
}
