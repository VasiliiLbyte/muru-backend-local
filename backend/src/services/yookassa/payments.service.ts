import { randomUUID } from 'node:crypto'

import { pool } from '../../utils/db'
import { env } from '../../utils/env'

import { ykFetch, getYkPayment, type YkPayment } from './client'
import { computeTrustedPricing } from './pricing.service'
import { buildSnapshotFromPricing } from './checkout-snapshot'
import {
  fulfillPaidPayment,
  markPaymentCanceled,
} from './order-from-payment.service'
import { buildReceipt, receiptTotalKop } from './receipt'
import type { OrderChannel } from '../../types/order'

const log = console

export type RawCheckoutInput = {
  telegramUserId: number | null
  channel: OrderChannel
  items: Array<{ sku: string; quantity: number; color?: string; size?: string }>
  promoCode: string | null
  deliveryMode: 'delivery' | 'pickup'
  deliveryOption: string | null
  deliveryEta: string | null
  address: string
  comment: string
  birthDate: string | null
  recipientName: string
  recipientPhone: string
  email: string | null
  /** Server-only: from verified customer JWT on web create; never from client body */
  customerId?: number | null
  cdekTariffCode: number | null
  cdekCityCode: number | null
  cdekCityName: string | null
  cdekPvzCode: string | null
  cdekPvzAddress: string | null
}

export type CheckoutSnapshot = {
  telegramUserId: number | null
  channel: OrderChannel
  items: Array<{ sku: string; name: string; price: number; quantity: number; color?: string; size?: string }>
  subtotal: number
  deliveryPrice: number
  promoCode: string | null
  promoDiscount: number
  total: number
  deliveryMode: 'delivery' | 'pickup'
  deliveryOption: string | null
  deliveryEta: string | null
  address: string
  comment: string
  birthDate: string | null
  recipientName: string
  recipientPhone: string
  email: string | null
  /** Server-stamped from customer JWT; never trust client-supplied id */
  customerId?: number | null
  cdekTariffCode: number | null
  cdekCityCode: number | null
  cdekCityName: string | null
  cdekPvzCode: string | null
  cdekPvzAddress: string | null
}

const markIntentCanceled = async (intentId: number, raw: unknown) => {
  await pool.query(`UPDATE payments SET status='canceled', raw_response=$2::jsonb, updated_at=NOW() WHERE id=$1`, [
    intentId,
    JSON.stringify(raw ?? null),
  ])
}

export const createPayment = async (
  raw: RawCheckoutInput,
): Promise<{ paymentId: string; confirmationUrl: string }> => {
  if (!env.yookassa.enabled) {
    throw new Error('YooKassa is not configured')
  }
  const returnUrl = raw.channel === 'web' ? env.yookassa.webReturnUrl : env.yookassa.returnUrl
  if (!returnUrl.trim()) {
    throw new Error(
      raw.channel === 'web'
        ? 'YOOKASSA_WEB_RETURN_URL is not configured'
        : 'YOOKASSA_RETURN_URL is not configured',
    )
  }

  const pricing = await computeTrustedPricing({
    telegramUserId: raw.telegramUserId,
    items: raw.items,
    deliveryMode: raw.deliveryMode,
    promoCode: raw.promoCode,
    cdekTariffCode: raw.cdekTariffCode,
    cdekCityCode: raw.cdekCityCode,
  })

  const snapshot = buildSnapshotFromPricing(raw, pricing)

  const productItems = snapshot.items.map((i) => ({
    description: i.name,
    priceKop: Math.round(i.price * 100),
    quantity: i.quantity,
  }))
  const deliveryKop = Math.round(snapshot.deliveryPrice * 100)
  const discountKop = Math.round(snapshot.promoDiscount * 100)
  const totalKop = receiptTotalKop({ productItems, deliveryKop, discountKop })
  const snapshotTotalKop = Math.round(snapshot.total * 100)

  if (totalKop !== snapshotTotalKop) {
    throw new Error(`Payment total mismatch: receipt ${totalKop} kop vs snapshot ${snapshotTotalKop} kop`)
  }

  const amountValue = (totalKop / 100).toFixed(2)
  const idempotenceKey = randomUUID()

  const intent = await pool.query<{ id: number }>(
    `INSERT INTO payments (status, amount, telegram_user_id, checkout_snapshot, idempotence_key, channel)
     VALUES ('pending', $1, $2, $3::jsonb, $4, $5)
     RETURNING id`,
    [amountValue, snapshot.telegramUserId, JSON.stringify(snapshot), idempotenceKey, snapshot.channel],
  )
  const intentId = intent.rows[0].id

  try {
    const receipt = buildReceipt({
      phone: snapshot.recipientPhone,
      email: snapshot.email,
      productItems,
      deliveryKop,
      discountKop,
    })

    const body = {
      amount: { value: amountValue, currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: returnUrl },
      description: `Заказ MURU (платёж ${intentId})`,
      metadata: {
        payment_intent_id: String(intentId),
        channel: snapshot.channel,
        ...(snapshot.telegramUserId != null
          ? { telegram_user_id: String(snapshot.telegramUserId) }
          : {}),
      },
      receipt,
    }

    const payment = await ykFetch<YkPayment>({
      method: 'POST',
      path: '/payments',
      channel: snapshot.channel,
      body,
      idempotenceKey,
    })

    const confirmationUrl = payment.confirmation?.confirmation_url
    if (!confirmationUrl) {
      await markIntentCanceled(intentId, payment)
      throw new Error('YooKassa did not return confirmation_url')
    }

    await pool.query(
      `UPDATE payments
       SET yookassa_payment_id=$1, status=$2, confirmation_url=$3, raw_response=$4::jsonb, updated_at=NOW()
       WHERE id=$5`,
      [payment.id, payment.status, confirmationUrl, JSON.stringify(payment), intentId],
    )

    return { paymentId: payment.id, confirmationUrl }
  } catch (error) {
    await markIntentCanceled(intentId, error instanceof Error ? { message: error.message } : error)
    throw error
  }
}

export const getPaymentStatusForUser = async (
  yookassaPaymentId: string,
  telegramUserId: number,
): Promise<{ status: string; orderId: number | null } | null> => {
  const r = await pool.query<{
    status: string
    order_id: number | null
    telegram_user_id: string
    channel: OrderChannel
  }>(
    `SELECT status, order_id, telegram_user_id, channel FROM payments WHERE yookassa_payment_id=$1`,
    [yookassaPaymentId],
  )
  const row = r.rows[0]
  if (!row) return null
  if (Number(row.telegram_user_id) !== telegramUserId) return null

  if (row.status === 'succeeded' || row.order_id) {
    return { status: row.status, orderId: row.order_id }
  }

  const isPending = row.status === 'pending' || row.status === 'waiting_for_capture'
  if (isPending && yookassaPaymentId) {
    const yk = await getYkPayment(yookassaPaymentId, row.channel).catch(() => null)
    if (yk?.status === 'succeeded' && yk.paid) {
      const orderId = await fulfillPaidPayment(yookassaPaymentId).catch((e) => {
        console.error('[yk-status] self-heal fulfill failed', e)
        return null
      })
      if (orderId) {
        log.log?.('[yk-status] self-heal succeeded', { paymentId: yookassaPaymentId, orderId })
      }
      return { status: 'succeeded', orderId: orderId ?? row.order_id }
    }
    if (yk?.status === 'canceled') {
      await markPaymentCanceled(yookassaPaymentId).catch(() => undefined)
      return { status: 'canceled', orderId: null }
    }
  }

  return { status: row.status, orderId: row.order_id }
}

export const getWebPaymentStatus = async (
  yookassaPaymentId: string,
): Promise<{ status: string; orderId: number | null } | null> => {
  const r = await pool.query<{
    status: string
    order_id: number | null
  }>(
    `SELECT status, order_id FROM payments WHERE yookassa_payment_id=$1 AND channel='web'`,
    [yookassaPaymentId],
  )
  const row = r.rows[0]
  if (!row) return null

  if (row.status === 'succeeded' || row.order_id) {
    return { status: row.status, orderId: row.order_id }
  }

  const isPending = row.status === 'pending' || row.status === 'waiting_for_capture'
  if (isPending) {
    const yk = await getYkPayment(yookassaPaymentId, 'web').catch(() => null)
    if (yk?.status === 'succeeded' && yk.paid) {
      const orderId = await fulfillPaidPayment(yookassaPaymentId).catch((e) => {
        console.error('[yk-web-status] self-heal fulfill failed', e)
        return null
      })
      if (orderId) {
        log.log?.('[yk-web-status] self-heal succeeded', { paymentId: yookassaPaymentId, orderId })
      }
      return { status: 'succeeded', orderId: orderId ?? row.order_id }
    }
    if (yk?.status === 'canceled') {
      await markPaymentCanceled(yookassaPaymentId).catch(() => undefined)
      return { status: 'canceled', orderId: null }
    }
  }

  return { status: row.status, orderId: row.order_id }
}

export const getPaymentIntentStatusForUser = async (
  intentId: number,
  telegramUserId: number,
): Promise<{ status: string; orderId: number | null } | null> => {
  const r = await pool.query<{
    status: string
    order_id: number | null
    telegram_user_id: string
  }>(`SELECT status, order_id, telegram_user_id FROM payments WHERE id=$1`, [intentId])
  const row = r.rows[0]
  if (!row) return null
  if (Number(row.telegram_user_id) !== telegramUserId) return null
  return { status: row.status, orderId: row.order_id }
}
