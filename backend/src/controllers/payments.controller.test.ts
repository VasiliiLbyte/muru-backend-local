import { describe, expect, it } from 'vitest'

import { snapshotSchema } from './payments.controller'

const base = {
  items: [{ sku: 'MU0001', quantity: 1 }],
  deliveryMode: 'pickup' as const,
  address: '',
  recipientName: 'Иван Иванов',
}

describe('snapshotSchema recipientPhone', () => {
  it('accepts common RU formats and normalizes to +7', () => {
    for (const phone of ['+79001234567', '89001234567', '9001234567', '79001234567']) {
      const parsed = snapshotSchema.safeParse({ ...base, recipientPhone: phone })
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.recipientPhone).toBe('+79001234567')
      }
    }
  })

  it('rejects garbage phone', () => {
    const parsed = snapshotSchema.safeParse({ ...base, recipientPhone: '123' })
    expect(parsed.success).toBe(false)
  })
})
