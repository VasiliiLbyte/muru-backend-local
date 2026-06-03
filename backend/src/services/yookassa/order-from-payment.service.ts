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

const snapshotToOrderInput = (snap: CheckoutSnapshot, yookassaPaymentId: string) => ({
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
  paymentId: yookassaPaymentId,
  paymentStatus: 'succeeded',
})

/**
 * Processes successful payment. Idempotent: returns existing order id if already linked.
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
    const order = await createOrder(snapshotToOrderInput(snapshot, yookassaPaymentId))

    await pool.query(`UPDATE payments SET order_id=$1 WHERE yookassa_payment_id=$2`, [
      order.id,
      yookassaPaymentId,
    ])

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
      console.error('[yk-fulfill:notify-admin]', err)
    })
    void notifyClientPaymentReceived(order).catch((err) => {
      console.error('[yk-fulfill:notify-client]', err)
    })

    log.log?.('[yk-fulfill] order created from payment', {
      orderId: order.id,
      paymentId: yookassaPaymentId,
      paymentRowId,
    })
    return order.id
  } catch (e) {
    log.error?.('[yk-fulfill] createOrder failed after payment succeeded', {
      yookassaPaymentId,
      paymentRowId,
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
