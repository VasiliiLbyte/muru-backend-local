import { describe, expect, it, vi } from 'vitest'

import { buildReceipt, normalizePhoneForReceipt, receiptTotalKop } from './receipt'

vi.mock('../../utils/env', () => ({
  env: { yookassa: { vatCode: 1 } },
}))

describe('receiptTotalKop', () => {
  it('matches sum of receipt line amounts in kopecks', () => {
    const productItems = [
      { description: 'Ваза', priceKop: 500_000, quantity: 1 },
      { description: 'Подушка', priceKop: 300_000, quantity: 2 },
    ]
    const deliveryKop = 50_000
    const discountKop = 100_000

    const totalKop = receiptTotalKop({ productItems, deliveryKop, discountKop })
    const receipt = buildReceipt({
      phone: '+79001234567',
      productItems,
      deliveryKop,
      discountKop,
    })

    const linesKop = receipt.items.map((item) =>
      Math.round(Number.parseFloat(item.amount.value) * 100),
    )
    expect(linesKop.reduce((s, v) => s + v, 0)).toBe(totalKop)
  })

  it('puts discount remainder on the last product line', () => {
    const productItems = [
      { description: 'A', priceKop: 100_00, quantity: 1 },
      { description: 'B', priceKop: 100_00, quantity: 1 },
      { description: 'C', priceKop: 100_00, quantity: 1 },
    ]
    const discountKop = 10_00
    const receipt = buildReceipt({
      phone: '89001234567',
      productItems,
      deliveryKop: 0,
      discountKop,
    })
    expect(receipt.items).toHaveLength(3)
    const lineKop = receipt.items.map((i) => Math.round(Number(i.amount.value) * 100))
    expect(lineKop[0] + lineKop[1] + lineKop[2]).toBe(290_00)
  })

  it('adds delivery as a separate service line', () => {
    const receipt = buildReceipt({
      phone: '+79001234567',
      productItems: [{ description: 'Товар', priceKop: 1000_00, quantity: 1 }],
      deliveryKop: 500_00,
      discountKop: 0,
    })
    expect(receipt.items).toHaveLength(2)
    expect(receipt.items[1].description).toBe('Доставка СДЭК')
    expect(receipt.items[1].payment_subject).toBe('service')
  })
})

describe('normalizePhoneForReceipt', () => {
  it('normalizes 8-prefix 11-digit numbers to +7', () => {
    expect(normalizePhoneForReceipt('89001234567')).toBe('+79001234567')
  })

  it('keeps 7-prefix 11-digit numbers as +7', () => {
    expect(normalizePhoneForReceipt('79001234567')).toBe('+79001234567')
  })

  it('adds +7 to 10-digit numbers', () => {
    expect(normalizePhoneForReceipt('9001234567')).toBe('+79001234567')
  })
})
