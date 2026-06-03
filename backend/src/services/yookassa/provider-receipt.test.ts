import { describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/env', () => ({
  env: { yookassa: { vatCode: 1 } },
}))

import { buildProviderData } from './provider-receipt'
import { receiptTotalKop } from './receipt'

describe('buildProviderData', () => {
  it('returns valid JSON with receipt wrapper', () => {
    const productItems = [{ description: 'Vase', priceKop: 100000, quantity: 1 }]
    const deliveryKop = 50000
    const discountKop = 0

    const raw = buildProviderData({
      phone: '+79001234567',
      productItems,
      deliveryKop,
      discountKop,
    })

    const parsed = JSON.parse(raw) as { receipt: { items: unknown[] } }
    expect(parsed.receipt).toBeDefined()
    expect(Array.isArray(parsed.receipt.items)).toBe(true)
    expect(parsed.receipt.items.length).toBeGreaterThan(0)
  })

  it('receipt total matches receiptTotalKop', () => {
    const productItems = [
      { description: 'Vase', priceKop: 100000, quantity: 1 },
      { description: 'Bowl', priceKop: 50000, quantity: 2 },
    ]
    const deliveryKop = 30000
    const discountKop = 10000

    const raw = buildProviderData({
      phone: '+79001234567',
      productItems,
      deliveryKop,
      discountKop,
    })

    const parsed = JSON.parse(raw) as {
      receipt: { items: { amount: { value: string } }[] }
    }
    const itemsSumKop = parsed.receipt.items.reduce(
      (sum, item) => sum + Math.round(Number(item.amount.value) * 100),
      0,
    )
    const expected = receiptTotalKop({ productItems, deliveryKop, discountKop })
    expect(itemsSumKop).toBe(expected)
  })
})
