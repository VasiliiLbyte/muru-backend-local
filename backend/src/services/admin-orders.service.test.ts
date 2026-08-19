import { describe, expect, it } from 'vitest'

import { isValidOrderStatus, ORDER_STATUSES } from '../constants/order-statuses'
import {
  normalizeAdminOrdersPage,
  normalizeAdminOrdersPageSize,
  shouldNotifyAssembling,
} from './admin-orders.helpers'

describe('order status helpers', () => {
  it('validates known statuses', () => {
    expect(isValidOrderStatus('Новый')).toBe(true)
    expect(isValidOrderStatus('Собирается')).toBe(true)
    expect(isValidOrderStatus('invalid')).toBe(false)
    expect(ORDER_STATUSES).toHaveLength(7)
  })

  it('should notify only on transition to Собирается', () => {
    expect(shouldNotifyAssembling('Новый', 'Собирается')).toBe(true)
    expect(shouldNotifyAssembling('Собирается', 'Собирается')).toBe(false)
    expect(shouldNotifyAssembling('Собирается', 'Доставлен')).toBe(false)
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
