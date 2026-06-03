import { pool } from '../../utils/db'
import { env } from '../../utils/env'
import { decreaseStockInSheets } from '../google-sheets-write.service'
import { createOrder } from '../orders.service'
import {
  notifyAdminsPaymentReceived,
  notifyClientPaymentReceived,
} from '../order-notifications.service'
import type { DeliveryMode } from '../../types/order'

import { getYkPayment } from './client'
import type { CheckoutSnapshot } from './payments.service'

const log = console

const snapshotToOrderInput = (snap: CheckoutSnapshot, paymentChargeId: string) => ({
  telegramUserId: snap.telegramUserId,
  items: snap.items,
  deliveryMode: snap.deliveryMode as DeliveryMode,
  deliveryOption: snap.deliveryOption ?? undefined,
  deliveryPrice: snap.deliveryPrice,
  deliveryEta: snap.deliveryEta ?? undefined,
  address: snap.address,
  comment: snap.comment,
  birthDate: snap.birthDate ?? undefined,
  promoCode: snap.promoCode ?? undefined,
  promoDiscount: snap.promoDiscount,
  recipientName: snap.recipientName,
  recipientPhone: snap.recipientPhone,
  cdekTariffCode: snap.cdekTariffCode ?? undefined,
  cdekCityCode: snap.cdekCityCode ?? undefined,
  cdekCityName: snap.cdekCityName ?? undefined,
  cdekPvzCode: snap.cdekPvzCode ?? undefined,
  cdekPvzAddress: snap.cdekPvzAddress ?? undefined,
  consentAccepted: true,
  paymentId: paymentChargeId,
  paymentStatus: 'succeeded',
})

const cancelOrphanOrder = async (orderId: number, items: { sku: string; quantity: number }[]) => {
  await pool.query(`UPDATE orders SET status='Отменён', updated_at=NOW() WHERE id=$1`, [orderId])
  for (const item of items) {
    await pool.query(`UPDATE products SET in_stock = in_stock + $1 WHERE sku = $2`, [
      item.quantity,
      item.sku,
    ])
  }
}

const completeOrderAfterPayment = async (
  snapshot: CheckoutSnapshot,
  chargeId: string,
  paymentRowId: number,
  logTag: string,
): Promise<number> => {
  const order = await createOrder(snapshotToOrderInput(snapshot, chargeId))

  const linkResult = await pool.query<{ id: number }>(
    `UPDATE payments SET order_id=$1 WHERE id=$2 AND order_id IS NULL RETURNING id`,
    [order.id, paymentRowId],
  )

  if (linkResult.rows.length === 0) {
    const existing = await pool.query<{ order_id: number | null }>(
      `SELECT order_id FROM payments WHERE id=$1`,
      [paymentRowId],
    )
    const existingOrderId = existing.rows[0]?.order_id
    if (existingOrderId) {
      log.warn?.(`[${logTag}] duplicate fulfill ignored`, {
        paymentRowId,
        orphanOrderId: order.id,
        existingOrderId,
      })
      await cancelOrphanOrder(order.id, order.items).catch((err) => {
        log.error?.(`[${logTag}] failed to cancel orphan order`, { orderId: order.id, err })
      })
      return existingOrderId
    }
    throw new Error(`Failed to link payment ${paymentRowId} to order ${order.id}`)
  }

  const stockUpdates = order.items.map((item) => ({
    sku: item.sku,
    quantity: item.quantity,
  }))
  if (env.enableSheetsStockWrite) {
    void decreaseStockInSheets(stockUpdates).catch((err) => {
      console.error('[sheets-write:error]', err)
    })
  }

  void notifyAdminsPaymentReceived(order).catch((err) => {
    console.error(`[${logTag}:notify-admin]`, err)
  })
  void notifyClientPaymentReceived(order).catch((err) => {
    console.error(`[${logTag}:notify-client]`, err)
  })

  log.log?.(`[${logTag}] order created from payment`, {
    orderId: order.id,
    paymentId: chargeId,
    paymentRowId,
  })
  return order.id
}

/**
 * Processes successful YooKassa redirect payment. Idempotent: returns existing order id if already linked.
 */
export const fulfillPaidPayment = async (yookassaPaymentId: string): Promise<number | null> => {
  const ykPayment = await getYkPayment(yookassaPaymentId)
  if (ykPayment.status !== 'succeeded' || !ykPayment.paid) {
    log.warn?.('[yk-fulfill] payment not succeeded', {
      id: yookassaPaymentId,
      status: ykPayment.status,
    })
    return null
  }

  const client = await pool.connect()
  let snapshot: CheckoutSnapshot
  let paymentRowId: number

  try {
    await client.query('BEGIN')
    const paymentRes = await client.query<{
      id: number
      order_id: number | null
      status: string
      checkout_snapshot: CheckoutSnapshot
    }>(
      `SELECT id, order_id, status, checkout_snapshot FROM payments
       WHERE yookassa_payment_id=$1 FOR UPDATE`,
      [yookassaPaymentId],
    )
    const payment = paymentRes.rows[0]
    if (!payment) {
      await client.query('ROLLBACK')
      return null
    }

    if (payment.order_id) {
      await client.query('COMMIT')
      return payment.order_id
    }

    await client.query(
      `UPDATE payments SET status='succeeded', paid_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [payment.id],
    )
    await client.query('COMMIT')

    snapshot = payment.checkout_snapshot
    paymentRowId = payment.id
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw e
  } finally {
    client.release()
  }

  try {
    return await completeOrderAfterPayment(snapshot, yookassaPaymentId, paymentRowId, 'yk-fulfill')
  } catch (e) {
    log.error?.('[yk-fulfill] createOrder failed after payment succeeded', {
      yookassaPaymentId,
      paymentRowId,
      e,
    })
    throw e
  }
}

/**
 * Processes successful Telegram native payment by payment intent id. Idempotent.
 */
export const fulfillPaidIntent = async (
  intentId: number,
  telegramPaymentChargeId: string,
): Promise<number | null> => {
  const client = await pool.connect()
  let snapshot: CheckoutSnapshot

  try {
    await client.query('BEGIN')
    const res = await client.query<{
      id: number
      order_id: number | null
      checkout_snapshot: CheckoutSnapshot
    }>(`SELECT id, order_id, checkout_snapshot FROM payments WHERE id=$1 FOR UPDATE`, [intentId])
    const row = res.rows[0]
    if (!row) {
      await client.query('ROLLBACK')
      return null
    }
    if (row.order_id) {
      await client.query('COMMIT')
      return row.order_id
    }
    await client.query(
      `UPDATE payments SET status='succeeded', paid_at=NOW(), yookassa_payment_id=$2, updated_at=NOW() WHERE id=$1`,
      [intentId, telegramPaymentChargeId],
    )
    await client.query('COMMIT')
    snapshot = row.checkout_snapshot
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw e
  } finally {
    client.release()
  }

  try {
    return await completeOrderAfterPayment(snapshot, telegramPaymentChargeId, intentId, 'tg-pay')
  } catch (e) {
    log.error?.('[tg-pay] createOrder failed after payment succeeded', {
      intentId,
      telegramPaymentChargeId,
      e,
    })
    throw e
  }
}

export const markPaymentCanceled = async (yookassaPaymentId: string): Promise<void> => {
  await pool.query(
    `UPDATE payments SET status='canceled', updated_at=NOW()
     WHERE yookassa_payment_id=$1 AND status NOT IN ('succeeded')`,
    [yookassaPaymentId],
  )
}

export const parseIntentPayload = (payload: string): number | null => {
  const m = payload.match(/^intent:(\d+)$/)
  if (!m) return null
  const id = Number(m[1])
  return Number.isInteger(id) && id > 0 ? id : null
}

export const validatePreCheckoutIntent = async (
  intentId: number,
  telegramUserId: number,
  totalAmountKop: number,
): Promise<{ ok: true } | { ok: false; errorMessage: string }> => {
  const res = await pool.query<{
    status: string
    telegram_user_id: string
    amount: string
  }>(`SELECT status, telegram_user_id, amount::text FROM payments WHERE id=$1`, [intentId])

  const row = res.rows[0]
  if (!row) {
    return { ok: false, errorMessage: 'Платёж не найден' }
  }
  if (row.status !== 'pending') {
    return { ok: false, errorMessage: 'Платёж уже обработан' }
  }
  if (Number(row.telegram_user_id) !== telegramUserId) {
    return { ok: false, errorMessage: 'Неверный пользователь' }
  }
  const expectedKop = Math.round(Number(row.amount) * 100)
  if (expectedKop !== totalAmountKop) {
    return { ok: false, errorMessage: 'Сумма не совпадает' }
  }
  return { ok: true }
}
