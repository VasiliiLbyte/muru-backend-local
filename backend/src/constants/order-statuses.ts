export const ORDER_STATUSES = [
  'Черновик',
  'Новый',
  'В обработке',
  'Подтверждён',
  'Собирается',
  'Передан в доставку',
  'Доставлен',
  'Отменён',
  'Возврат',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const DEFAULT_PLACED_ORDER_STATUS = 'Новый' as const

export const ORDER_STATUS_CANCELLED = 'Отменён' as const

export const ORDER_STATUS_RETURNED = 'Возврат' as const

export const ORDER_STATUS_CONFIRMED = 'Подтверждён' as const

export const ORDER_TERMINAL_STATUSES = [ORDER_STATUS_CANCELLED, ORDER_STATUS_RETURNED] as const

export type TerminalOrderStatus = (typeof ORDER_TERMINAL_STATUSES)[number]

export const isTerminalOrderStatus = (status: string): status is TerminalOrderStatus =>
  (ORDER_TERMINAL_STATUSES as readonly string[]).includes(status)

export const isValidOrderStatus = (value: string): value is OrderStatus =>
  (ORDER_STATUSES as readonly string[]).includes(value)
