import { describe, expect, it } from 'vitest'

import { listPriceFromSale, roundMoney2, salePriceFromList } from './product-price-math'

describe('product-price-math', () => {
  it('salePriceFromList: 1800 + 20% → 1440', () => {
    expect(salePriceFromList(1800, 20)).toBe(1440)
  })

  it('salePriceFromList: discount 0 → list', () => {
    expect(salePriceFromList(1800, 0)).toBe(1800)
  })

  it('listPriceFromSale: 1440 + 20% → 1800 (migration restore)', () => {
    expect(listPriceFromSale(1440, 20)).toBe(1800)
  })

  it('round-trip sale↔list for common percents', () => {
    for (const d of [5, 10, 15, 20, 25, 50]) {
      const list = 2000
      const sale = salePriceFromList(list, d)
      expect(listPriceFromSale(sale, d)).toBe(list)
    }
  })

  it('roundMoney2', () => {
    expect(roundMoney2(1440.005)).toBe(1440.01)
    expect(roundMoney2(1440.004)).toBe(1440)
  })
})
