import { describe, expect, it } from 'vitest'

import { countActiveOrders } from '../constants/order-statuses'

describe('countActiveOrders', () => {
  it('sums counts for Новый, Собирается, and В пути', () => {
    expect(
      countActiveOrders({
        Новый: 2,
        Собирается: 1,
        'В пути': 3,
        Доставлен: 5,
      }),
    ).toBe(6)
  })

  it('treats missing active keys as zero', () => {
    expect(countActiveOrders({ Новый: 1 })).toBe(1)
    expect(countActiveOrders({})).toBe(0)
  })
})
