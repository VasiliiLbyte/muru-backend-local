import type { OrderDraft } from '../types/order'
import { env } from '../utils/env'
import { sendEmail } from './email.service'

const OLIVE = '#5D6B3A'

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const formatMoney = (value: number): string => `${Number(value).toFixed(2)} ₽`

const formatOrderDate = (_order: OrderDraft): string => {
  // OrderDraft has no created_at; use current time at send.
  return new Date().toLocaleString('ru-RU')
}

const buildItemsRows = (order: OrderDraft): string =>
  order.items
    .map((item) => {
      const meta = [item.color, item.size].filter(Boolean).join(' / ')
      const metaHtml = meta
        ? `<div style="color:#6b7280;font-size:12px;margin-top:2px;">${escapeHtml(meta)}</div>`
        : ''
      const lineTotal = Number(item.price) * Number(item.quantity)
      return `<tr>
  <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
    <div style="font-weight:600;">${escapeHtml(item.name)}</div>
    ${metaHtml}
  </td>
  <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
  <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(lineTotal)}</td>
</tr>`
    })
    .join('')

const buildTotalsBlock = (order: OrderDraft): string => `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:14px;color:#2c2c2c;">
  <tr>
    <td style="padding:4px 0;">Подытог</td>
    <td style="padding:4px 0;text-align:right;">${formatMoney(order.subtotal)}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;">Доставка</td>
    <td style="padding:4px 0;text-align:right;">${formatMoney(order.deliveryPrice)}</td>
  </tr>
  <tr>
    <td style="padding:8px 0;font-weight:700;color:${OLIVE};">Итого</td>
    <td style="padding:8px 0;text-align:right;font-weight:700;color:${OLIVE};">${formatMoney(order.total)}</td>
  </tr>
</table>`

const buildDeliveryBlock = (order: OrderDraft, recipientName?: string): string => {
  const modeLabel =
    order.deliveryMode === 'pickup'
      ? 'Самовывоз'
      : order.deliveryOption
        ? escapeHtml(order.deliveryOption)
        : 'Доставка'
  const pvz = order.cdekPvzAddress ? escapeHtml(order.cdekPvzAddress) : ''
  const address = order.address ? escapeHtml(order.address) : ''
  const recipient = recipientName
    ? escapeHtml(recipientName)
    : order.recipientName
      ? escapeHtml(order.recipientName)
      : ''

  const lines = [
    `<p style="margin:8px 0 0;font-size:14px;color:#2c2c2c;"><strong>Доставка:</strong> ${modeLabel}</p>`,
  ]
  if (pvz) {
    lines.push(
      `<p style="margin:4px 0 0;font-size:14px;color:#2c2c2c;"><strong>ПВЗ:</strong> ${pvz}</p>`,
    )
  } else if (address) {
    lines.push(
      `<p style="margin:4px 0 0;font-size:14px;color:#2c2c2c;"><strong>Адрес:</strong> ${address}</p>`,
    )
  }
  if (recipient) {
    lines.push(
      `<p style="margin:4px 0 0;font-size:14px;color:#2c2c2c;"><strong>Получатель:</strong> ${recipient}</p>`,
    )
  }
  return lines.join('')
}

const buildShell = (body: string): string => `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f2;padding:24px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td style="background:${OLIVE};padding:20px 24px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:2px;">
            MURU
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#f5f0e0;color:#6b7280;font-size:12px;text-align:center;">
            MURU Home Design
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`

export const buildCustomerOrderEmailHtml = (
  order: OrderDraft,
  contact: { recipientName?: string },
): string => {
  const greeting = contact.recipientName
    ? `Спасибо за заказ, ${escapeHtml(contact.recipientName)}!`
    : 'Спасибо за заказ!'
  const questionsEmail = env.emailReplyTo || 'info@muru.ru'

  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;color:${OLIVE};">${greeting}</h1>
    <p style="margin:0;font-size:14px;color:#2c2c2c;">
      <strong>Заказ #${order.id}</strong> от ${escapeHtml(formatOrderDate(order))}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse;font-size:14px;color:#2c2c2c;">
      <thead>
        <tr>
          <th align="left" style="padding:8px;border-bottom:2px solid ${OLIVE};">Товар</th>
          <th style="padding:8px;border-bottom:2px solid ${OLIVE};">Кол-во</th>
          <th align="right" style="padding:8px;border-bottom:2px solid ${OLIVE};">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${buildItemsRows(order)}
      </tbody>
    </table>
    ${buildTotalsBlock(order)}
    ${buildDeliveryBlock(order, contact.recipientName)}
    <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">
      Вопросы — <a href="mailto:${escapeHtml(questionsEmail)}" style="color:${OLIVE};">${escapeHtml(questionsEmail)}</a>
    </p>
  `

  return buildShell(body)
}

export const buildManagerOrderEmailHtml = (
  order: OrderDraft,
  contact: { recipientName?: string; email?: string; phone?: string },
): string => {
  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;color:${OLIVE};">Новый оплаченный заказ #${order.id}</h1>
    <p style="margin:0;font-size:14px;color:#2c2c2c;">Дата: ${escapeHtml(formatOrderDate(order))}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:14px;color:#2c2c2c;">
      <tr><td style="padding:4px 0;"><strong>Имя:</strong></td><td style="padding:4px 0;">${escapeHtml(contact.recipientName || '—')}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Email:</strong></td><td style="padding:4px 0;">${escapeHtml(contact.email || '—')}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Телефон:</strong></td><td style="padding:4px 0;">${escapeHtml(contact.phone || '—')}</td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse;font-size:14px;color:#2c2c2c;">
      <thead>
        <tr>
          <th align="left" style="padding:8px;border-bottom:2px solid ${OLIVE};">Товар</th>
          <th style="padding:8px;border-bottom:2px solid ${OLIVE};">Кол-во</th>
          <th align="right" style="padding:8px;border-bottom:2px solid ${OLIVE};">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${buildItemsRows(order)}
      </tbody>
    </table>
    ${buildTotalsBlock(order)}
    ${buildDeliveryBlock(order, contact.recipientName)}
    <p style="margin:20px 0 0;font-size:14px;">
      <a href="https://murushop.ru/admin/orders/${order.id}" style="color:${OLIVE};font-weight:700;">
        Открыть заказ в админке
      </a>
    </p>
  `

  return buildShell(body)
}

export const sendOrderEmails = async (
  order: OrderDraft,
  contact: { email?: string; recipientName?: string; phone?: string },
): Promise<void> => {
  if (contact.email) {
    try {
      await sendEmail({
        to: contact.email,
        subject: `Заказ #${order.id} принят — MURU`,
        html: buildCustomerOrderEmailHtml(order, { recipientName: contact.recipientName }),
        replyTo: env.emailReplyTo || undefined,
      })
    } catch (error) {
      console.error('[order-email] customer send failed', error)
    }
  }

  if (!env.orderManagerEmail) {
    console.log('[order-email] ORDER_MANAGER_EMAIL empty, skip manager email')
    return
  }

  try {
    await sendEmail({
      to: env.orderManagerEmail,
      subject: `Новый оплаченный заказ #${order.id}`,
      html: buildManagerOrderEmailHtml(order, contact),
    })
  } catch (error) {
    console.error('[order-email] manager send failed', error)
  }
}
