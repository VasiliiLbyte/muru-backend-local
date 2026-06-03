import { randomUUID } from 'node:crypto'

import { pool } from '../../utils/db'
import { env } from '../../utils/env'

import { ykFetch, type YkPayment } from './client'
import { buildReceipt, receiptTotalKop } from './receipt'

export type CheckoutSnapshot = {
  telegramUserId: number
  items: Array<{ sku: string; name: string; price: number; quantity: number; color?: string; size?: string }>
  subtotal: number
  deliveryPrice: number
  promoCode: string | null
  promoDiscount: number
  total: number
  deliveryMode: string
  deliveryOption: string | null
  deliveryEta: string | null
  address: string
  comment: string
  birthDate: string | null
  recipientName: string
  recipientPhone: string
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
  snapshot: CheckoutSnapshot,
): Promise<{ paymentId: string; confirmationUrl: string }> => {
  if (!env.yookassa.enabled) {
    throw new Error('YooKassa is not configured')
  }
  if (!env.yookassa.returnUrl.trim()) {
    throw new Error('YOOKASSA_RETURN_URL is not configured')
  }

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
    `INSERT INTO payments (status, amount, telegram_user_id, checkout_snapshot, idempotence_key)
     VALUES ('pending', $1, $2, $3::jsonb, $4)
     RETURNING id`,
    [amountValue, snapshot.telegramUserId, JSON.stringify(snapshot), idempotenceKey],
  )
  const intentId = intent.rows[0].id

  try {
    const receipt = buildReceipt({
      phone: snapshot.recipientPhone,
      productItems,
      deliveryKop,
      discountKop,
    })

    const body = {
      amount: { value: amountValue, currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: env.yookassa.returnUrl },
      description: `Заказ MURU (платёж ${intentId})`,
      metadata: {
        payment_intent_id: String(intentId),
        telegram_user_id: String(snapshot.telegramUserId),
      },
      receipt,
    }

    const payment = await ykFetch<YkPayment>({
      method: 'POST',
      path: '/payments',
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
  const r = await pool.query<{ status: string; order_id: number | null; telegram_user_id: string }>(
    `SELECT status, order_id, telegram_user_id FROM payments WHERE yookassa_payment_id=$1`,
    [yookassaPaymentId],
  )
  const row = r.rows[0]
  if (!row) return null
  if (Number(row.telegram_user_id) !== telegramUserId) return null
  return { status: row.status, orderId: row.order_id }
}
