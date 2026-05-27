import { describe, expect, it } from 'vitest'

import { validateProductDimsUpdate } from './admin-product-dims.validation'

describe('validateProductDimsUpdate', () => {
  it('accepts valid dims', () => {
    expect(
      validateProductDimsUpdate({
        weightGrams: 350,
        lengthCm: 12,
        widthCm: 12,
        heightCm: 10,
      }),
    ).toEqual({ ok: true })
  })

  it('rejects non-integer values', () => {
    const result = validateProductDimsUpdate({
      weightGrams: 350.5,
      lengthCm: 12,
      widthCm: 12,
      heightCm: 10,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('целыми')
    }
  })

  it('rejects side over 150 cm', () => {
    const result = validateProductDimsUpdate({
      weightGrams: 500,
      lengthCm: 151,
      widthCm: 20,
      heightCm: 20,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('150')
    }
  })

  it('rejects weight over 30 kg', () => {
    const result = validateProductDimsUpdate({
      weightGrams: 30_001,
      lengthCm: 20,
      widthCm: 20,
      heightCm: 20,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('30')
    }
  })
})
