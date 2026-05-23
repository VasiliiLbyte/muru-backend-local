import { describe, expect, it } from 'vitest'

import { isValidOrderStatus, ORDER_STATUSES } from '../constants/order-statuses'
import {
  normalizeAdminOrdersPage,
  normalizeAdminOrdersPageSize,
  shouldNotifyConfirmed,
} from './admin-orders.helpers'

describe('order status helpers', () => {
  it('validates known statuses', () => {
    expect(isValidOrderStatus('Новый')).toBe(true)
    expect(isValidOrderStatus('Подтверждён')).toBe(true)
    expect(isValidOrderStatus('invalid')).toBe(false)
    expect(ORDER_STATUSES).toHaveLength(9)
  })

  it('should notify only on transition to Подтверждён', () => {
    expect(shouldNotifyConfirmed('Новый', 'Подтверждён')).toBe(true)
    expect(shouldNotifyConfirmed('Подтверждён', 'Подтверждён')).toBe(false)
    expect(shouldNotifyConfirmed('В обработке', 'Доставлен')).toBe(false)
  })
})

describe('normalizeAdminOrdersPage', () => {
  it('defaults invalid page to 1', () => {
    expect(normalizeAdminOrdersPage(undefined)).toBe(1)
    expect(normalizeAdminOrdersPage(0)).toBe(1)
    expect(normalizeAdminOrdersPage('abc')).toBe(1)
  })

  it('accepts positive integers', () => {
    expect(normalizeAdminOrdersPage(3)).toBe(3)
  })
})

describe('normalizeAdminOrdersPageSize', () => {
  it('defaults to 20 and caps at 100', () => {
    expect(normalizeAdminOrdersPageSize(undefined)).toBe(20)
    expect(normalizeAdminOrdersPageSize(200)).toBe(100)
    expect(normalizeAdminOrdersPageSize(50)).toBe(50)
  })
})
