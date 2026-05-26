import { describe, expect, it } from 'vitest'

import { normalizeRussianPhone } from './phone'

describe('normalizeRussianPhone', () => {
  it('normalizes 11-digit numbers starting with 7 or 8', () => {
    expect(normalizeRussianPhone('79001234567')).toBe('+79001234567')
    expect(normalizeRussianPhone('89001234567')).toBe('+79001234567')
    expect(normalizeRussianPhone('+7 (900) 123-45-67')).toBe('+79001234567')
  })

  it('normalizes 10-digit numbers', () => {
    expect(normalizeRussianPhone('9001234567')).toBe('+79001234567')
  })

  it('returns null for invalid input', () => {
    expect(normalizeRussianPhone('123')).toBeNull()
    expect(normalizeRussianPhone('')).toBeNull()
    expect(normalizeRussianPhone(null)).toBeNull()
  })
})
