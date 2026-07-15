import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}))

import { HttpError } from '../utils/api-response'
import {
  buildProductCatalogPath,
  createLookbookHotspot,
  deleteLookbookHotspot,
  listPublicHotspotsForLookbook,
} from './content-hotspots.service'

describe('content-hotspots.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('buildProductCatalogPath uses category and subcategory slugs', () => {
    expect(
      buildProductCatalogPath({
        sku: 'MU0001',
        categorySlug: 'kuhnya-i-stolovaya',
        webSubcategorySlug: 'posuda',
        subcategorySlug: null,
      }),
    ).toBe('/catalog/kuhnya-i-stolovaya/posuda/MU0001/')
  })

  it('createLookbookHotspot returns 404 when lookbook missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await expect(
      createLookbookHotspot(9, { productId: 1, xPercent: 10, yPercent: 20 }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Lookbook not found',
    })
  })

  it('createLookbookHotspot returns 404 when product archived', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })

    await expect(
      createLookbookHotspot(1, { productId: 99, xPercent: 10, yPercent: 20 }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Product not found or archived',
    })
  })

  it('createLookbookHotspot inserts hotspot row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            lookbook_id: 1,
            product_id: 5,
            x_percent: '50.00',
            y_percent: '30.00',
            sort_order: 0,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })

    const created = await createLookbookHotspot(1, {
      productId: 5,
      xPercent: 50,
      yPercent: 30,
    })

    expect(created.productId).toBe(5)
    expect(created.xPercent).toBe(50)
    expect(String(mockQuery.mock.calls[2][0])).toContain('INSERT INTO content_lookbook_hotspots')
  })

  it('listPublicHotspotsForLookbook excludes archived products via join', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          lookbook_id: 2,
          product_id: 5,
          x_percent: '40.00',
          y_percent: '60.00',
          sort_order: 0,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          sku: 'MU0001',
          name: 'Vase',
          price: '1000',
          discount_percent: '10',
          image_url_1: 'https://example.com/vase.webp',
          image_urls: [],
          category_slug: 'interer',
          web_subcategory_slug: 'vazy',
          subcategory_slug: null,
        },
      ],
    })

    const hotspots = await listPublicHotspotsForLookbook(2)

    expect(String(mockQuery.mock.calls[0][0])).toContain('p.is_archived = FALSE')
    expect(hotspots).toHaveLength(1)
    expect(hotspots[0].product.sku).toBe('MU0001')
    expect(hotspots[0].product.salePrice).toBe(1000)
    expect(hotspots[0].product.slug).toBe('/catalog/interer/vazy/MU0001/')
  })

  it('deleteLookbookHotspot throws 404 when row missing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rowCount: 0 })

    await expect(deleteLookbookHotspot(1, 99)).rejects.toBeInstanceOf(HttpError)
  })

  it('buildProductCatalogPath falls back to category slug when subcategory missing', () => {
    expect(
      buildProductCatalogPath({
        sku: 'MU0002',
        categorySlug: 'tekstil',
        webSubcategorySlug: null,
        subcategorySlug: null,
      }),
    ).toBe('/catalog/tekstil/tekstil/MU0002/')
  })
})
