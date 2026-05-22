import { describe, expect, it } from 'vitest'

import { buildTwoSlotImageUrls } from './google-sync-image-urls'

describe('product image slots from Drive orders', () => {
  const ph = 'https://drive.example/placeholder'

  it('uses orders 1, 2 and 3 when all three exist', () => {
    const urls = ['https://p/1.png', 'https://p/2.png', 'https://p/3.png']
    expect(buildTwoSlotImageUrls(urls, ph)).toEqual(['https://p/1.png', 'https://p/2.png', 'https://p/3.png'])
  })

  it('single main URL when only slot 1 is passed from sync layer', () => {
    expect(buildTwoSlotImageUrls(['https://p/1.png'], ph)).toEqual(['https://p/1.png'])
  })
})
