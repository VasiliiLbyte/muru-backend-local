import type { OrderDraft } from '../types/order'
import { callTelegramApi } from './telegram-http.service'
import { sendEmail } from './email.service'
import { env } from '../utils/env'

const formatOrderSummary = (order: OrderDraft) =>
  [
    `Заказ #${order.id}`,
    `Статус: ${order.status}`,
    `Telegram user: ${order.telegramUserId}`,
    `Сумма: ${order.total.toFixed(2)} ₽`,
    `Доставка: ${order.deliveryMode}${order.deliveryOption ? ` (${order.deliveryOption})` : ''}`,
  ].join(' | ')

export const notifyAdminsByTelegram = async (order: OrderDraft): Promise<void> => {
  const summary = formatOrderSummary(order)
  const targetIds = env.orderNotifyTelegramIds.length > 0 ? env.orderNotifyTelegramIds : env.adminTelegramIds

  for (const chatId of targetIds) {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: summary,
    })
  }
}

export const notifyByEmail = async (order: OrderDraft): Promise<void> => {
  const itemsHtml = order.items
    .map(
      (item) => `<tr>
      <td>${item.name}</td>
      <td>${item.quantity} шт.</td>
      <td>${item.price.toFixed(2)} ₽</td>
    </tr>`,
    )
    .join('')

  await sendEmail({
    to: env.orderNotifyEmail || 'Muru_online@mail.ru',
    subject: `Новый заказ MURU #${order.id}`,
    html: `
      <h2>Новый заказ #${order.id}</h2>
      <p><strong>Telegram ID:</strong> ${order.telegramUserId}</p>
      <p><strong>Доставка:</strong> ${order.deliveryMode === 'pickup' ? 'Самовывоз' : (order.deliveryOption ?? 'Доставка')}</p>
      <p><strong>Адрес:</strong> ${order.address || '—'}</p>
      <p><strong>Комментарий:</strong> ${order.comment || '—'}</p>
      <table border="1" cellpadding="6" style="border-collapse:collapse">
        <thead><tr><th>Товар</th><th>Количество</th><th>Цена</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p><strong>Итого: ${order.total.toFixed(2)} ₽</strong></p>
      <p>Дата: ${new Date().toLocaleString('ru-RU')}</p>
    `,
  })
}

export const notifyClientStatusChange = async (
  order: OrderDraft,
  newStatus: string,
): Promise<void> => {
  if (!env.telegramBotToken) return

  const etaLine = order.deliveryEta ? `Ориентировочная дата: ${order.deliveryEta}` : ''

  try {
    await callTelegramApi('sendMessage', {
      chat_id: order.telegramUserId,
      parse_mode: 'HTML',
      text: [
        `✅ <b>Заказ #${order.id} подтверждён</b>`,
        '',
        `Статус: <b>${newStatus}</b>`,
        `Сумма: <b>${order.total.toFixed(2)} ₽</b>`,
        etaLine,
        '',
        'Спасибо за заказ! Мы свяжемся с вами при необходимости.',
      ]
        .filter(Boolean)
        .join('\n'),
    })
  } catch (error) {
    console.error('[notify-client-status:error]', error)
  }
}

export const notifyClientByTelegram = async (order: OrderDraft): Promise<void> => {
  if (!env.telegramBotToken) return

  try {
    await callTelegramApi('sendMessage', {
      chat_id: order.telegramUserId,
      parse_mode: 'HTML',
      text: [
        `✅ <b>Заказ #${order.id} принят!</b>`,
        '',
        `Сумма: <b>${order.total.toFixed(2)} ₽</b>`,
        `Доставка: ${order.deliveryMode === 'pickup' ? 'Самовывоз' : (order.deliveryOption ?? 'Курьер')}`,
        order.address ? `Адрес: ${order.address}` : '',
        '',
        'Менеджер свяжется с вами в ближайшее время.',
      ]
        .filter(Boolean)
        .join('\n'),
    })
  } catch (error) {
    console.error('[notify-client:error]', error)
  }
}

export const notifyAdminsPaymentReceived = async (order: OrderDraft): Promise<void> => {
  const text = `💰 Оплачен заказ #${order.id} на сумму ${order.total.toFixed(2)} ₽`
  const targetIds = env.orderNotifyTelegramIds.length > 0 ? env.orderNotifyTelegramIds : env.adminTelegramIds

  for (const chatId of targetIds) {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text,
    })
  }
}

export const notifyClientPaymentReceived = async (order: OrderDraft): Promise<void> => {
  if (!env.telegramBotToken) return

  try {
    await callTelegramApi('sendMessage', {
      chat_id: order.telegramUserId,
      text: `Оплата получена, заказ #${order.id} принят в работу`,
    })
  } catch (error) {
    console.error('[notify-client-payment:error]', error)
  }
}

export const notifyAdminsCdekError = async (orderId: number, errMsg: string): Promise<void> => {
  const text = `⚠️ Заказ #${orderId}: не удалось создать в СДЭК\n${errMsg}\nПовторить в админке.`
  const targetIds = env.orderNotifyTelegramIds.length > 0 ? env.orderNotifyTelegramIds : env.adminTelegramIds

  for (const chatId of targetIds) {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text,
    })
  }
}

export const notifyRestockRequestByTelegram = async (payload: {
  telegramUserId: number
  sku: string
  productName: string
}): Promise<void> => {
  const targetIds = env.orderNotifyTelegramIds.length > 0 ? env.orderNotifyTelegramIds : env.adminTelegramIds
  const message = [
    'Запрос на уведомление о поступлении',
    `SKU: ${payload.sku}`,
    `Товар: ${payload.productName}`,
    `Telegram user: ${payload.telegramUserId}`,
    `Время: ${new Date().toISOString()}`,
  ].join('\n')

  for (const chatId of targetIds) {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: message,
    })
  }
}

