import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()

vi.mock('../utils/db', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}))

vi.mock('./catalog-placeholder.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./catalog-placeholder.service')>()
  return {
    ...actual,
    getCatalogPlaceholderImageUrl: vi.fn(async () => '/uploads/catalog-placeholder.webp'),
  }
})

import { searchCatalogProducts, suggestCatalogSearch } from './catalog-search.service'

describe('searchCatalogProducts', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('returns empty result for short query without hitting the database', async () => {
    const result = await searchCatalogProducts({ q: 'a', channel: 'web' })
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 24 })
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('builds ranked paginated query for valid query', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })
      .mockResolvedValueOnce({
        rows: [
          { sku: 'MU0001', search_rank: '90' },
          { sku: 'MU0002', search_rank: '40' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    const result = await searchCatalogProducts({ q: 'ваза', channel: 'web', page: 1, pageSize: 24 })

    expect(result.total).toBe(2)
    expect(queryMock).toHaveBeenCalled()
    const countSql = String(queryMock.mock.calls[0]?.[0] ?? '')
    expect(countSql).toContain('COUNT(DISTINCT p.sku)')
    const rankSql = String(queryMock.mock.calls[1]?.[0] ?? '')
    expect(rankSql).toContain('similarity(')
    expect(rankSql).toContain('search_rank')
  })
})

describe('suggestCatalogSearch', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('returns empty arrays for invalid query', async () => {
    const result = await suggestCatalogSearch({ q: ' ', channel: 'web' })
    expect(result).toEqual({ products: [], categories: [] })
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('limits products and categories in SQL', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            sku: 'MU0001',
            slug: 'vaza',
            name: 'Ваза',
            price: '1000',
            discount_percent: '0',
            in_stock: 1,
            is_gift_guide: false,
            is_new_arrival: false,
            new_arrival_at: null,
            image_url_1: 'https://example.com/1.webp',
            image_url_2: '',
            image_urls: ['https://example.com/1.webp'],
            category_name: 'Декор',
            product_color: null,
            dimensions_label: '',
            color_tags: null,
            weight_grams: 1000,
            variant_color: null,
            variant_size: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            category_name: 'Декор',
            category_slug: 'dekor',
            subcategory_name: 'Вазы',
            subcategory_slug: 'vazy',
          },
        ],
      })

    const result = await suggestCatalogSearch({ q: 'ваза', channel: 'web' })

    expect(result.products).toHaveLength(1)
    expect(result.categories).toHaveLength(1)
    const productSql = String(queryMock.mock.calls[0]?.[0] ?? '')
    expect(productSql).toContain('LIMIT $')
    const categorySql = String(queryMock.mock.calls[1]?.[0] ?? '')
    expect(categorySql).toContain('LIMIT $')
  })
})
