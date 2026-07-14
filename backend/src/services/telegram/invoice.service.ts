import { randomUUID } from 'node:crypto'

import { pool } from '../../utils/db'
import { env } from '../../utils/env'
import { callTelegramApi } from '../telegram-http.service'

import { buildSnapshotFromPricing } from '../yookassa/checkout-snapshot'
import type { RawCheckoutInput } from '../yookassa/payments.service'
import { computeTrustedPricing } from '../yookassa/pricing.service'
import { buildProviderData } from '../yookassa/provider-receipt'
import { receiptTotalKop } from '../yookassa/receipt'

const TELEGRAM_INVOICE_URL_PREFIXES = ['https://t.me/$', 'https://telegram.me/$'] as const

const isValidTelegramInvoiceUrl = (url: string): boolean =>
  TELEGRAM_INVOICE_URL_PREFIXES.some((prefix) => url.startsWith(prefix))

export const createInvoiceForCheckout = async (
  raw: RawCheckoutInput,
): Promise<{ invoiceUrl: string; intentId: number }> => {
  if (!env.payments.nativeEnabled) {
    throw new Error('Native Telegram payments are not configured')
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

  const productItems = pricing.items.map((i) => ({
    description: i.name,
    priceKop: Math.round(i.price * 100),
    quantity: i.quantity,
  }))
  const deliveryKop = Math.round(pricing.deliveryPrice * 100)
  const discountKop = Math.round(pricing.promoDiscount * 100)
  const totalKop = receiptTotalKop({ productItems, deliveryKop, discountKop })
  const snapshotTotalKop = Math.round(pricing.total * 100)

  if (totalKop !== snapshotTotalKop) {
    throw new Error(`Invoice total mismatch: receipt ${totalKop} kop vs snapshot ${snapshotTotalKop} kop`)
  }

  const intent = await pool.query<{ id: number }>(
    `INSERT INTO payments (status, amount, telegram_user_id, checkout_snapshot, idempotence_key)
     VALUES ('pending', $1, $2, $3::jsonb, $4)
     RETURNING id`,
    [pricing.total.toFixed(2), snapshot.telegramUserId, JSON.stringify(snapshot), randomUUID()],
  )
  const intentId = intent.rows[0].id

  const providerData = buildProviderData({
    phone: snapshot.recipientPhone,
    productItems,
    deliveryKop,
    discountKop,
  })

  const description = pricing.items
    .map((i) => `${i.name} ×${i.quantity}`)
    .join(', ')
    .slice(0, 255)

  const link = await callTelegramApi<string>('createInvoiceLink', {
    title: 'Заказ MURU',
    description: description || 'Заказ MURU',
    payload: `intent:${intentId}`,
    provider_token: env.telegramProviderToken,
    currency: 'RUB',
    prices: [{ label: 'Заказ', amount: totalKop }],
    need_name: false,
    need_phone_number: false,
    need_email: false,
    send_phone_number_to_provider: true,
    provider_data: providerData,
  })

  if (!isValidTelegramInvoiceUrl(link)) {
    throw new Error('Telegram createInvoiceLink returned an invalid invoice URL')
  }

  await pool.query(`UPDATE payments SET confirmation_url=$2, updated_at=NOW() WHERE id=$1`, [
    intentId,
    link,
  ])

  return { invoiceUrl: link, intentId }
}
