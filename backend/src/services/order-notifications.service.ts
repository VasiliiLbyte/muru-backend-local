import type { OrderDraft } from '../types/order'
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

  if (!env.telegramBotToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required for Telegram notifications')
  }

  for (const chatId of targetIds) {
    const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: summary,
      }),
    })
    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Telegram notify failed for chat ${chatId}: ${errorBody}`)
    }
  }
}

export const notifyByEmail = async (order: OrderDraft): Promise<void> => {
  const summary = formatOrderSummary(order)
  console.log('[email-order-notify:stub]', {
    mode: 'stub',
    to: env.orderNotifyEmail,
    smtpConfigured: Boolean(env.smtpHost && env.smtpUser && env.smtpPass),
    subject: `Новый заказ #${order.id}`,
    body: summary,
  })
}

export const notifyRestockRequestByTelegram = async (payload: {
  telegramUserId: number
  sku: string
  productName: string
}): Promise<void> => {
  if (!env.telegramBotToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required for Telegram notifications')
  }

  const targetIds = env.orderNotifyTelegramIds.length > 0 ? env.orderNotifyTelegramIds : env.adminTelegramIds
  const message = [
    'Запрос на уведомление о поступлении',
    `SKU: ${payload.sku}`,
    `Товар: ${payload.productName}`,
    `Telegram user: ${payload.telegramUserId}`,
    `Время: ${new Date().toISOString()}`,
  ].join('\n')

  for (const chatId of targetIds) {
    const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    })
    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Restock notify failed for chat ${chatId}: ${errorBody}`)
    }
  }
}

