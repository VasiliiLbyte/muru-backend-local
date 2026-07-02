import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()

vi.mock('../utils/db', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}))

import {
  getCatalogProductBySku,
  getCatalogProducts,
  getCatalogTree,
} from './catalog.service'

const baseProductRow = {
  sku: 'MU0001',
  name: 'Тестовый товар',
  price: '1000',
  discount_percent: '0',
  in_stock: 5,
  image_url_1: 'https://example.com/1.webp',
  image_url_2: 'https://example.com/1.webp',
  image_urls: ['https://example.com/1.webp'],
  category_name: 'Кухня и столовая',
  subcategory: 'Посуда',
  subcategory_slug: 'посуда',
  product_color: null,
  dimensions_label: null,
  color_tags: null,
  weight_grams: 3000,
  variant_color: null,
  variant_size: null,
}

describe('getCatalogProducts', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('maps real subcategory and subcategorySlug from DB columns', async () => {
    queryMock.mockResolvedValueOnce({ rows: [baseProductRow] })

    const products = await getCatalogProducts({})

    expect(products).toHaveLength(1)
    expect(products[0].category).toBe('Кухня и столовая')
    expect(products[0].subcategory).toBe('Посуда')
    expect(products[0].subcategorySlug).toBe('посуда')
    expect(products[0].subcategory).not.toBe('Общее')
  })

  it('uses empty subcategory when DB value is null', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...baseProductRow, subcategory: null, subcategory_slug: null }],
    })

    const products = await getCatalogProducts({})

    expect(products[0].subcategory).toBe('')
    expect(products[0].subcategorySlug).toBeUndefined()
  })

  it('applies independent level-1 and level-2 slug filters', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({
      categorySlug: 'кухня-и-столовая',
      subcategorySlug: 'посуда',
    })

    const sql = String(queryMock.mock.calls[0][0])
    const values = queryMock.mock.calls[0][1] as unknown[]

    expect(sql).toContain('c.slug = $1')
    expect(sql).toContain('p.subcategory_slug = $2')
    expect(values).toEqual(['кухня-и-столовая', 'посуда'])
  })

  it('applies ILIKE fallbacks for category and subcategory names', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({
      category: 'Кухня',
      subcategory: 'Посуда',
    })

    const sql = String(queryMock.mock.calls[0][0])
    const values = queryMock.mock.calls[0][1] as unknown[]

    expect(sql).toContain('c.name ILIKE $1')
    expect(sql).toContain('p.subcategory ILIKE $2')
    expect(values).toEqual(['%Кухня%', '%Посуда%'])
  })
})

describe('getCatalogProductBySku', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('maps real subcategory fields in detail DTO', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...baseProductRow, description: 'Описание', specs: { Материал: 'Керамика' } }],
    })

    const detail = await getCatalogProductBySku('MU0001')

    expect(detail).not.toBeNull()
    expect(detail!.category).toBe('Кухня и столовая')
    expect(detail!.subcategory).toBe('Посуда')
    expect(detail!.subcategorySlug).toBe('посуда')
  })

  it('returns empty subcategory when DB value is null', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          ...baseProductRow,
          subcategory: null,
          subcategory_slug: null,
          description: '',
          specs: {},
        },
      ],
    })

    const detail = await getCatalogProductBySku('MU0001')

    expect(detail!.subcategory).toBe('')
    expect(detail!.subcategorySlug).toBeUndefined()
  })
})

describe('getCatalogTree', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('does not query product subcategories when withSubcategories is false', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ name: 'Кухня и столовая' }] })
      .mockResolvedValueOnce({ rows: [{ slug: 'кухня-и-столовая' }] })
      .mockResolvedValueOnce({ rows: [] })

    const tree = await getCatalogTree(false)

    expect(queryMock).toHaveBeenCalledTimes(3)
    expect(String(queryMock.mock.calls[2][0])).toContain('cover_image_url')
    expect(tree[0]?.children).toEqual([])
  })

  it('attaches real subcategory children when withSubcategories is true', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ name: 'Кухня и столовая' }] })
      .mockResolvedValueOnce({ rows: [{ slug: 'кухня-и-столовая' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            category: 'Кухня и столовая',
            category_slug: 'кухня-и-столовая',
            subcategory: 'Посуда',
            subcategory_slug: 'посуда',
            cnt: 12,
          },
          {
            category: 'Кухня и столовая',
            category_slug: 'кухня-и-столовая',
            subcategory: 'Сервировка',
            subcategory_slug: 'сервировка',
            cnt: 3,
          },
        ],
      })

    const tree = await getCatalogTree(true)

    expect(queryMock).toHaveBeenCalledTimes(4)
    expect(String(queryMock.mock.calls[3][0])).toContain('p.subcategory_slug')
    const kitchen = tree.find((node) => node.slug === 'кухня-и-столовая')
    expect(kitchen?.children).toEqual([
      { name: 'Посуда', slug: 'посуда', children: [] },
      { name: 'Сервировка', slug: 'сервировка', children: [] },
    ])
  })
})
