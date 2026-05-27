import { describe, expect, it } from 'vitest'

import {
  estimateWeightGrams,
  parseColorTags,
  parseDimensionsLabel,
} from './google-sync-dimensions'

describe('parseDimensionsLabel', () => {
  it('parses comma decimal and round object (11,8×10,3)', () => {
    expect(parseDimensionsLabel('11,8×10,3')).toEqual({
      lengthCm: 12,
      widthCm: 12,
      heightCm: 10,
    })
  })

  it('parses three dimensions (30×40×50)', () => {
    expect(parseDimensionsLabel('30×40×50')).toEqual({
      lengthCm: 30,
      widthCm: 40,
      heightCm: 50,
    })
  })

  it('parses single number as cube (17.5)', () => {
    expect(parseDimensionsLabel('17.5')).toEqual({
      lengthCm: 18,
      widthCm: 18,
      heightCm: 18,
    })
  })

  it('parses large textile folded (140×220) with clamp to 150', () => {
    expect(parseDimensionsLabel('140×220')).toEqual({
      lengthCm: 140,
      widthCm: 150,
      heightCm: 2,
    })
  })

  it('parses three-part size with commas (15,2×2×15,5)', () => {
    expect(parseDimensionsLabel('15,2×2×15,5')).toEqual({
      lengthCm: 15,
      widthCm: 2,
      heightCm: 16,
    })
  })

  it('returns null for non-dimension text', () => {
    expect(parseDimensionsLabel('Зеленый;оранжевый')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseDimensionsLabel('')).toBeNull()
  })

  it('parses spaced latin x (30 x 40 x 50)', () => {
    expect(parseDimensionsLabel('  30 x 40 x 50  ')).toEqual({
      lengthCm: 30,
      widthCm: 40,
      heightCm: 50,
    })
  })
})

describe('estimateWeightGrams', () => {
  it('estimates hollow ceramic vase 20×20×30', () => {
    const grams = estimateWeightGrams(
      { lengthCm: 20, widthCm: 20, heightCm: 30 },
      'Керамика',
    )
    expect(grams).toBe(9600)
  })

  it('estimates textile pillowcase 50×70×2', () => {
    const grams = estimateWeightGrams(
      { lengthCm: 50, widthCm: 70, heightCm: 2 },
      'Хлопок',
    )
    expect(grams).toBe(2100)
  })

  it('estimates wax candle 8×8×15', () => {
    const grams = estimateWeightGrams(
      { lengthCm: 8, widthCm: 8, heightCm: 15 },
      'Воск',
    )
    expect(grams).toBe(864)
  })

  it('uses default density when material is empty', () => {
    const grams = estimateWeightGrams({ lengthCm: 10, widthCm: 10, heightCm: 10 }, undefined)
    expect(grams).toBe(500)
  })
})

describe('parseColorTags', () => {
  it('extracts multiple colors from comma-separated list', () => {
    const tags = parseColorTags('Бежевый, кремовый')
    expect(tags).toContain('бежевый')
    expect(tags).toContain('кремовый')
  })

  it('extracts stem-matched color from phrase', () => {
    const tags = parseColorTags('Бежевый с коричневыми разводами')
    expect(tags).toContain('бежевый')
    expect(tags).toContain('коричневый')
  })

  it('returns empty array for empty input', () => {
    expect(parseColorTags('')).toEqual([])
  })
})
