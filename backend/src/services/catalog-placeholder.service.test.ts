import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}))

import {
  applyPlaceholderToImageUrls,
  FALLBACK_CATALOG_PLACEHOLDER,
  getCatalogPlaceholderImageUrl,
  isGenericPlaceholderUrl,
  LEGACY_PLACEHOLD_CO,
} from './catalog-placeholder.service'

describe('catalog-placeholder.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isGenericPlaceholderUrl', () => {
    it('treats empty and placehold.co as generic', () => {
      expect(isGenericPlaceholderUrl('')).toBe(true)
      expect(isGenericPlaceholderUrl(null)).toBe(true)
      expect(isGenericPlaceholderUrl(LEGACY_PLACEHOLD_CO)).toBe(true)
      expect(isGenericPlaceholderUrl('https://placehold.co/600x600')).toBe(true)
      expect(isGenericPlaceholderUrl('/uploads/real.webp')).toBe(false)
      expect(isGenericPlaceholderUrl(FALLBACK_CATALOG_PLACEHOLDER)).toBe(false)
    })
  })

  describe('applyPlaceholderToImageUrls', () => {
    const ph = '/uploads/brand.webp'

    it('empty → [placeholder]', () => {
      expect(applyPlaceholderToImageUrls([], ph)).toEqual([ph])
    })

    it('all generic → [placeholder]', () => {
      expect(applyPlaceholderToImageUrls([LEGACY_PLACEHOLD_CO], ph)).toEqual([ph])
      expect(
        applyPlaceholderToImageUrls([LEGACY_PLACEHOLD_CO, 'https://placehold.co/x'], ph),
      ).toEqual([ph])
    })

    it('first generic → [placeholder]', () => {
      expect(
        applyPlaceholderToImageUrls([LEGACY_PLACEHOLD_CO, '/uploads/real.webp'], ph),
      ).toEqual([ph])
    })

    it('real first drops trailing generics', () => {
      expect(
        applyPlaceholderToImageUrls(['/uploads/a.webp', LEGACY_PLACEHOLD_CO], ph),
      ).toEqual(['/uploads/a.webp'])
    })
  })

  describe('getCatalogPlaceholderImageUrl', () => {
    it('returns DB value when set', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ catalog_placeholder_image_url: ' /uploads/custom.webp ' }],
      })
      await expect(getCatalogPlaceholderImageUrl()).resolves.toBe('/uploads/custom.webp')
    })

    it('returns FALLBACK when empty', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ catalog_placeholder_image_url: null }] })
      await expect(getCatalogPlaceholderImageUrl()).resolves.toBe(FALLBACK_CATALOG_PLACEHOLDER)
    })
  })
})
