import type { CrmOrderListItem, OrderChannel } from '../types/orders'

export const formatOrderDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU')
}

export const formatMoney = (value: number) => `${value.toLocaleString('ru-RU')} ₽`

export const getChannelLabel = (channel: OrderChannel) =>
  channel === 'web' ? 'Сайт' : 'Telegram'

export const isOrderPaid = (order: Pick<CrmOrderListItem, 'paidAt' | 'paymentStatus'>) =>
  order.paidAt != null || order.paymentStatus === 'succeeded'

export const getPaymentLabel = (order: Pick<CrmOrderListItem, 'paidAt' | 'paymentStatus'>) => {
  if (isOrderPaid(order)) return 'Оплачен'
  return order.paymentStatus ?? 'Не оплачен'
}

export const deliveryEtaToInput = (eta: string | null | undefined) => {
  if (!eta) return ''
  const date = new Date(eta)
  if (Number.isNaN(date.getTime())) {
    return eta.length >= 10 ? eta.slice(0, 10) : eta
  }
  return date.toISOString().slice(0, 10)
}

export const inputToDeliveryEta = (value: string) => (value.trim() ? value.trim() : null)
