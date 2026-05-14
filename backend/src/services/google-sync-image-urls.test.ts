import { describe, expect, it } from 'vitest'

import { buildTwoSlotImageUrls } from './google-sync-image-urls'

const ph = 'https://drive.example/placeholder'

describe('buildTwoSlotImageUrls', () => {
  it('returns product URLs only when placeholder is null', () => {
    expect(buildTwoSlotImageUrls([], null)).toEqual([])
    expect(buildTwoSlotImageUrls(['a'], null)).toEqual(['a'])
    expect(buildTwoSlotImageUrls(['a', 'b'], null)).toEqual(['a', 'b'])
  })

  it('uses placeholder for both slots when no product images', () => {
    expect(buildTwoSlotImageUrls([], ph)).toEqual([ph, ph])
  })

  it('uses placeholder for second slot when one product image', () => {
    expect(buildTwoSlotImageUrls(['https://p/1.webp'], ph)).toEqual(['https://p/1.webp', ph])
  })

  it('uses first two product URLs when two or more exist', () => {
    expect(buildTwoSlotImageUrls(['https://p/1.webp', 'https://p/2.webp'], ph)).toEqual([
      'https://p/1.webp',
      'https://p/2.webp',
    ])
    expect(buildTwoSlotImageUrls(['https://p/1.webp', 'https://p/2.webp', 'https://p/3.webp'], ph)).toEqual([
      'https://p/1.webp',
      'https://p/2.webp',
    ])
  })
})
