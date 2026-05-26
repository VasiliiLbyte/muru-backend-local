import { pool } from '../../utils/db'
import { env } from '../../utils/env'
import { notifyAdminsCdekError } from '../order-notifications.service'
import { cdekFetch, CdekApiError } from './client'
import { normalizeRussianPhone } from './phone'

const log = {
  warn: (payload: unknown, msg?: string) => console.warn('[cdek-orders]', msg ?? '', payload),
  info: (payload: unknown, msg?: string) => console.log('[cdek-orders]', msg ?? '', payload),
  error: (payload: unknown, msg?: string) => console.error('[cdek-orders]', msg ?? '', payload),
}

const normalizedSenderPhone = normalizeRussianPhone(env.cdek.senderPhone)
if (env.cdek.senderPhone && !normalizedSenderPhone) {
  console.warn('[cdek-orders] CDEK_SENDER_PHONE is invalid:', env.cdek.senderPhone)
}

type OrderRow = {
  id: number
  telegram_user_id: string
  comment: string
  cdek_tariff_code: number | null
  cdek_to_city_code: number | null
  cdek_to_city_name: string | null
  cdek_pvz_code: string | null
  cdek_pvz_address: string | null
  cdek_recipient_name: string | null
  cdek_recipient_phone: string | null
  address: string
}

const markCdekError = async (
  orderId: number,
  errMsg: string,
  responsePayload: unknown = null,
  notify = false,
) => {
  await pool.query(
    `UPDATE orders
     SET cdek_sync_state = 'error',
         cdek_create_error = $2,
         cdek_create_response = $3
     WHERE id = $1`,
    [orderId, errMsg, responsePayload],
  )
  if (notify) {
    void Promise.resolve(notifyAdminsCdekError(orderId, errMsg)).catch((notifyError) => {
      log.error({ orderId, notifyError }, 'cdek error notify failed')
    })
  }
}

export const createCdekOrder = async (orderId: number): Promise<{ uuid: string } | null> => {
  const r = await pool.query<OrderRow>(`SELECT * FROM orders WHERE id = $1 LIMIT 1`, [orderId])
  const order = r.rows[0]
  if (!order) return null

  if (!order.cdek_tariff_code || !order.cdek_to_city_code) {
    log.warn({ orderId }, 'cdek fields missing, skip create')
    await markCdekError(orderId, 'missing tariff/city')
    return null
  }

  const prof = await pool.query<{ full_name: string; phone: string }>(
    `SELECT full_name, phone FROM user_profiles WHERE telegram_user_id = $1`,
    [order.telegram_user_id],
  )
  const recipientName = order.cdek_recipient_name ?? prof.rows[0]?.full_name?.trim() ?? 'Клиент MURU'
  const rawRecipientPhone = order.cdek_recipient_phone ?? prof.rows[0]?.phone?.trim() ?? ''
  const recipientPhone = normalizeRussianPhone(rawRecipientPhone)
  if (!recipientPhone) {
    log.warn({ orderId }, 'recipient phone missing or invalid')
    await markCdekError(
      orderId,
      rawRecipientPhone ? `recipient phone invalid: ${rawRecipientPhone}` : 'recipient phone missing',
    )
    return null
  }

  const senderPhone = normalizedSenderPhone ?? env.cdek.senderPhone
  if (!normalizeRussianPhone(senderPhone)) {
    await markCdekError(orderId, 'sender phone invalid or missing in env')
    return null
  }

  const items = await pool.query<{
    product_sku: string
    product_name: string
    price: string
    quantity: number
  }>(
    `SELECT product_sku, product_name, price::text, quantity FROM order_items WHERE order_id = $1`,
    [orderId],
  )

  const weights = await pool.query<{
    sku: string
    weight_grams: number
    dim_length_cm: number
    dim_width_cm: number
    dim_height_cm: number
  }>(
    `SELECT sku, weight_grams, dim_length_cm, dim_width_cm, dim_height_cm
     FROM products WHERE sku = ANY($1::text[])`,
    [items.rows.map((i) => i.product_sku)],
  )
  const wMap = new Map(weights.rows.map((w) => [w.sku, w]))

  let totalWeight = 0
  let length = 20
  let width = 20
  let height = 20
  const cdekItems = items.rows.map((it) => {
    const w = wMap.get(it.product_sku)
    const itemWeight = w?.weight_grams ?? 500
    totalWeight += itemWeight * it.quantity
    length = Math.max(length, w?.dim_length_cm ?? 20)
    width = Math.max(width, w?.dim_width_cm ?? 20)
    height = Math.max(height, w?.dim_height_cm ?? 20)
    return {
      name: it.product_name.slice(0, 100),
      ware_key: it.product_sku,
      payment: { value: 0 },
      cost: Number(it.price),
      weight: itemWeight,
      amount: it.quantity,
    }
  })

  const isPvz = !!order.cdek_pvz_code

  const body: Record<string, unknown> = {
    type: 1,
    tariff_code: order.cdek_tariff_code,
    number: `MURU-${order.id}`,
    comment: order.comment || undefined,
    from_location: {
      code: env.cdek.senderCityCode,
      address: env.cdek.senderAddress,
    },
    sender: {
      name: env.cdek.senderName,
      phones: [{ number: normalizedSenderPhone! }],
    },
    recipient: {
      name: recipientName,
      phones: [{ number: recipientPhone }],
    },
    packages: [
      {
        number: `MURU-${order.id}-PKG1`,
        weight: Math.max(totalWeight, 100),
        length,
        width,
        height,
        items: cdekItems,
        comment: `Заказ MURU #${order.id}`,
      },
    ],
  }

  if (isPvz) {
    body.delivery_point = order.cdek_pvz_code
  } else {
    body.to_location = {
      code: order.cdek_to_city_code,
      address: order.address || `${order.cdek_to_city_name ?? ''}`.trim(),
    }
  }

  await pool.query(`UPDATE orders SET cdek_create_payload = $2::jsonb WHERE id = $1`, [
    orderId,
    JSON.stringify(body),
  ])

  try {
    const resp = await cdekFetch<{ entity?: { uuid?: string } }>('/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const uuid = resp?.entity?.uuid ?? null
    await pool.query(
      `UPDATE orders
       SET cdek_uuid = $2,
           cdek_create_response = $3::jsonb,
           cdek_sync_state = 'created',
           cdek_create_error = NULL
       WHERE id = $1`,
      [orderId, uuid, JSON.stringify(resp ?? null)],
    )
    log.info({ orderId, uuid }, 'cdek order created')
    if (uuid) {
      const { schedulePullTrackNumber } = await import('./track-poll.service')
      schedulePullTrackNumber(orderId, uuid)
    }
    return uuid ? { uuid } : null
  } catch (e) {
    const apiErr =
      e instanceof CdekApiError
        ? e
        : e && typeof e === 'object' && 'status' in e && 'path' in e
          ? (e as CdekApiError)
          : null
    const errMsg = apiErr ? `${apiErr.status}: ${apiErr.message}` : e instanceof Error ? e.message : 'unknown error'
    await markCdekError(orderId, errMsg, apiErr?.payload ?? null, true)
    log.error({ orderId, errMsg }, 'cdek order failed')
    throw e
  }
}

export const retryCdekOrder = createCdekOrder
