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

export const ORDER_STATUS_CANCELLED = 'Отменён' as const

export const CRM_EDITABLE_STATUSES = ORDER_STATUSES.filter((s) => s !== 'Черновик')
