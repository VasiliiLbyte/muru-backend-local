export const ORDER_STATUSES = [
  'Черновик',
  'Новый',
  'Собирается',
  'В пути',
  'Доставлен',
  'Отменён',
  'Возврат',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_CANCELLED = 'Отменён' as const

export const ACTIVE_ORDER_STATUSES = ['Новый', 'Собирается', 'В пути'] as const

export type ActiveOrderStatus = (typeof ACTIVE_ORDER_STATUSES)[number]

export const CRM_EDITABLE_STATUSES = ORDER_STATUSES.filter((s) => s !== 'Черновик')

export const countActiveOrders = (statusCounts: Record<string, number>): number =>
  ACTIVE_ORDER_STATUSES.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0)
