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

  it('uses ROW_NUMBER CTE and returns categorySlug/subcategorySlug', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            sku: 'MU0001',
            slug: 'vaza',
            name: 'Ваза',
            price: '1000',
            discount_percent: '0',
            image_url_1: 'https://example.com/1.webp',
            image_url_2: '',
            image_urls: ['https://example.com/1.webp'],
            category_slug: 'dekor',
            subcategory_slug: 'vazy',
            search_rank: '80',
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
    expect(result.products[0].categorySlug).toBe('dekor')
    expect(result.products[0].subcategorySlug).toBe('vazy')
    expect(result.categories).toHaveLength(1)
    const productSql = String(queryMock.mock.calls[0]?.[0] ?? '')
    expect(productSql).toContain('ROW_NUMBER()')
    expect(productSql).toContain('ORDER BY search_rank DESC')
    expect(productSql).toContain('LIMIT $')
    expect(productSql).not.toContain('DISTINCT ON')
  })

  it('returns products ordered by rank, not alphabetically', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            sku: 'MU0001',
            slug: 'vaza',
            name: 'Ваза керамическая',
            price: '1000',
            discount_percent: '0',
            image_url_1: 'https://example.com/1.webp',
            image_url_2: '',
            image_urls: ['https://example.com/1.webp'],
            category_slug: 'dekor',
            subcategory_slug: 'vazy',
            search_rank: '90',
          },
          {
            sku: 'MU0002',
            slug: 'podsvechnik',
            name: 'Подсвечник',
            price: '500',
            discount_percent: '0',
            image_url_1: 'https://example.com/2.webp',
            image_url_2: '',
            image_urls: ['https://example.com/2.webp'],
            category_slug: 'dekor',
            subcategory_slug: '',
            search_rank: '20',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    const result = await suggestCatalogSearch({ q: 'ваза', channel: 'web' })

    expect(result.products).toHaveLength(2)
    expect(result.products[0].name).toBe('Ваза керамическая')
    expect(result.products[1].name).toBe('Подсвечник')
  })
})
