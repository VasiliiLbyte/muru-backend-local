import { describe, expect, it } from 'vitest'

import {
  calculatePromoDiscount,
  normalizeMoney,
  normalizePromoCode,
  resolvePromoDisplayStatus,
} from './promo.helpers'

describe('normalizePromoCode', () => {
  it('uppercases and trims', () => {
    expect(normalizePromoCode('  muru10  ')).toBe('MURU10')
  })
})

describe('calculatePromoDiscount', () => {
  it('applies percent discount capped by subtotal', () => {
    expect(calculatePromoDiscount('percent', 10, 1000)).toBe(100)
    expect(calculatePromoDiscount('percent', 50, 100)).toBe(50)
  })

  it('applies fixed discount capped by subtotal', () => {
    expect(calculatePromoDiscount('fixed', 300, 1000)).toBe(300)
    expect(calculatePromoDiscount('fixed', 500, 200)).toBe(200)
  })

  it('returns zero for empty subtotal', () => {
    expect(calculatePromoDiscount('percent', 10, 0)).toBe(0)
  })
})

describe('resolvePromoDisplayStatus', () => {
  const now = new Date('2026-05-23T12:00:00Z')

  it('marks inactive as Отключён', () => {
    expect(
      resolvePromoDisplayStatus({
        is_active: false,
        starts_at: null,
        expires_at: null,
        usage_limit: null,
        used_count: 0,
        now,
      }),
    ).toBe('Отключён')
  })

  it('marks expired by date or limit as Истёк', () => {
    expect(
      resolvePromoDisplayStatus({
        is_active: true,
        starts_at: null,
        expires_at: '2026-05-22T12:00:00Z',
        usage_limit: 10,
        used_count: 1,
        now,
      }),
    ).toBe('Истёк')

    expect(
      resolvePromoDisplayStatus({
        is_active: true,
        starts_at: null,
        expires_at: null,
        usage_limit: 5,
        used_count: 5,
        now,
      }),
    ).toBe('Истёк')
  })

  it('marks active promo as Активен', () => {
    expect(
      resolvePromoDisplayStatus({
        is_active: true,
        starts_at: '2026-05-01T00:00:00Z',
        expires_at: '2026-12-31T23:59:59Z',
        usage_limit: 10,
        used_count: 2,
        now,
      }),
    ).toBe('Активен')
  })
})

describe('normalizeMoney', () => {
  it('rounds to two decimals', () => {
    expect(normalizeMoney(10.556)).toBe(10.56)
  })
})
