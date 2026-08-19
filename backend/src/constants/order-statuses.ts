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

export const DEFAULT_PLACED_ORDER_STATUS = 'Новый' as const

export const ORDER_STATUS_CANCELLED = 'Отменён' as const

export const ORDER_STATUS_RETURNED = 'Возврат' as const

export const ORDER_STATUS_ASSEMBLING = 'Собирается' as const

export const ACTIVE_ORDER_STATUSES = ['Новый', 'Собирается', 'В пути'] as const

export type ActiveOrderStatus = (typeof ACTIVE_ORDER_STATUSES)[number]

export const ORDER_TERMINAL_STATUSES = [ORDER_STATUS_CANCELLED, ORDER_STATUS_RETURNED] as const

export type TerminalOrderStatus = (typeof ORDER_TERMINAL_STATUSES)[number]

export const isTerminalOrderStatus = (status: string): status is TerminalOrderStatus =>
  (ORDER_TERMINAL_STATUSES as readonly string[]).includes(status)

export const isValidOrderStatus = (value: string): value is OrderStatus =>
  (ORDER_STATUSES as readonly string[]).includes(value)

export const countActiveOrders = (statusCounts: Record<string, number>): number =>
  ACTIVE_ORDER_STATUSES.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0)
