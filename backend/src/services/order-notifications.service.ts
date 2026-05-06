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

  for (const chatId of targetIds) {
    console.log('[telegram-order-notify:stub]', {
      mode: 'stub',
      botTokenConfigured: Boolean(env.telegramBotToken),
      chatId,
      orderId: order.id,
      message: summary,
    })
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

