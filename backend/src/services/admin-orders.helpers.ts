import {
  ORDER_STATUS_CONFIRMED,
} from '../constants/order-statuses'

export const normalizeAdminOrdersPage = (page: unknown): number => {
  const parsed = Number(page)
  if (!Number.isInteger(parsed) || parsed < 1) return 1
  return parsed
}

export const normalizeAdminOrdersPageSize = (pageSize: unknown): number => {
  const parsed = Number(pageSize)
  if (!Number.isInteger(parsed) || parsed < 1) return 20
  return Math.min(parsed, 100)
}

export const shouldNotifyConfirmed = (previousStatus: string, newStatus: string): boolean =>
  newStatus === ORDER_STATUS_CONFIRMED && previousStatus !== ORDER_STATUS_CONFIRMED
