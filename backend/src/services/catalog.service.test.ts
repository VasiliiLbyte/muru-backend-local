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
  web_subcategory_name: null,
  web_subcategory_slug: null,
  cross_category_name: null,
  cross_category_slug: null,
  cross_subcategory_name: null,
  cross_subcategory_slug: null,
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

  it('maps web subcategory (column F) when channel=web', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          ...baseProductRow,
          web_subcategory_name: 'Посуда',
          web_subcategory_slug: 'посуда',
        },
      ],
    })

    const products = await getCatalogProducts({ channel: 'web' })

    expect(products).toHaveLength(1)
    expect(products[0].subcategory).toBe('Посуда')
    expect(products[0].subcategorySlug).toBe('посуда')
    expect(products[0].webPrimarySubcategory).toEqual({ name: 'Посуда', slug: 'посуда' })
  })

  it('uses empty subcategory when DB value is null', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...baseProductRow }],
    })

    const products = await getCatalogProducts({})

    expect(products[0].subcategory).toBe('')
    expect(products[0].subcategorySlug).toBeUndefined()
  })

  it('filters only by primary category slug without channel', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({
      categorySlug: 'кухня-и-столовая',
      subcategorySlug: 'посуда',
    })

    const sql = String(queryMock.mock.calls[0][0])
    const values = queryMock.mock.calls[0][1] as unknown[]

    expect(sql).toContain('c.slug = $1')
    expect(sql).not.toContain('pwcp')
    expect(sql).not.toContain('web_subcategory_slug')
    expect(values).toEqual(['кухня-и-столовая'])
  })

  it('ignores subcategory filters for telegram channel', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({
      channel: 'telegram',
      categorySlug: 'кухня-и-столовая',
      subcategorySlug: 'посуда',
    })

    const sql = String(queryMock.mock.calls[0][0])
    const values = queryMock.mock.calls[0][1] as unknown[]

    expect(sql).toContain('c.slug = $1')
    expect(sql).not.toMatch(/WHERE[\s\S]*p\.subcategory_slug/)
    expect(values).toEqual(['кухня-и-столовая'])
  })

  it('applies ILIKE fallback for category name without subcategory filter', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({
      category: 'Кухня',
      subcategory: 'Посуда',
    })

    const sql = String(queryMock.mock.calls[0][0])
    const values = queryMock.mock.calls[0][1] as unknown[]

    expect(sql).toContain('c.name ILIKE $1')
    expect(sql).not.toContain('p.subcategory ILIKE')
    expect(values).toEqual(['%Кухня%'])
  })

  it('joins cross placements and filters primary or cross for web channel', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({
      channel: 'web',
      categorySlug: 'кухня-и-столовая',
      subcategorySlug: 'сервировка',
    })

    const sql = String(queryMock.mock.calls[0][0])
    const values = queryMock.mock.calls[0][1] as unknown[]

    expect(sql).toContain('product_web_cross_placements pwcp')
    expect(sql).toContain('c_cross.slug')
    expect(sql).toContain('p.web_subcategory_slug')
    expect(values).toEqual(['кухня-и-столовая', 'сервировка'])
  })

  it('maps web-only DTO fields when channel=web', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          ...baseProductRow,
          web_subcategory_name: 'Подсвечники',
          web_subcategory_slug: 'подсвечники',
          cross_category_name: 'Кухня и столовая',
          cross_category_slug: 'кухня-и-столовая',
          cross_subcategory_name: 'Сервировка',
          cross_subcategory_slug: 'сервировка',
        },
      ],
    })

    const products = await getCatalogProducts({ channel: 'web' })

    expect(products[0].webPrimarySubcategory).toEqual({
      name: 'Подсвечники',
      slug: 'подсвечники',
    })
    expect(products[0].webCrossPlacement).toEqual({
      category: 'Кухня и столовая',
      categorySlug: 'кухня-и-столовая',
      subcategoryName: 'Сервировка',
      subcategorySlug: 'сервировка',
    })
  })

  it('omits web-only DTO fields without channel', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          ...baseProductRow,
          web_subcategory_name: 'Подсвечники',
          web_subcategory_slug: 'подсвечники',
        },
      ],
    })

    const products = await getCatalogProducts({})

    expect(products[0].webPrimarySubcategory).toBeUndefined()
    expect(products[0].webCrossPlacement).toBeUndefined()
  })
})

describe('getCatalogProductBySku', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('returns empty subcategory in detail without channel (mini app)', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          ...baseProductRow,
          web_subcategory_name: 'Посуда',
          web_subcategory_slug: 'посуда',
          description: 'Описание',
          specs: { Материал: 'Керамика' },
        },
      ],
    })

    const detail = await getCatalogProductBySku('MU0001')

    expect(detail).not.toBeNull()
    expect(detail!.category).toBe('Кухня и столовая')
    expect(detail!.subcategory).toBe('')
    expect(detail!.subcategorySlug).toBeUndefined()
  })

  it('maps web subcategory in detail when channel=web', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          ...baseProductRow,
          web_subcategory_name: 'Посуда',
          web_subcategory_slug: 'посуда',
          description: 'Описание',
          specs: { Материал: 'Керамика' },
        },
      ],
    })

    const detail = await getCatalogProductBySku('MU0001', 'web')

    expect(detail!.subcategory).toBe('Посуда')
    expect(detail!.subcategorySlug).toBe('посуда')
  })

  it('returns empty subcategory when DB value is null', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          ...baseProductRow,
          description: '',
          specs: {},
        },
      ],
    })

    const detail = await getCatalogProductBySku('MU0001')

    expect(detail!.subcategory).toBe('')
    expect(detail!.subcategorySlug).toBeUndefined()
  })

  it('includes web fields when channel=web', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          ...baseProductRow,
          description: 'Описание',
          specs: {},
          web_subcategory_name: 'Подсвечники',
          web_subcategory_slug: 'подсвечники',
          cross_category_name: 'Кухня и столовая',
          cross_category_slug: 'кухня-и-столовая',
          cross_subcategory_name: 'Сервировка',
          cross_subcategory_slug: 'сервировка',
        },
      ],
    })

    const detail = await getCatalogProductBySku('MU0001', 'web')

    expect(String(queryMock.mock.calls[0][0])).toContain('product_web_cross_placements pwcp')
    expect(detail!.webPrimarySubcategory).toEqual({
      name: 'Подсвечники',
      slug: 'подсвечники',
    })
    expect(detail!.webCrossPlacement?.categorySlug).toBe('кухня-и-столовая')
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
    expect(String(queryMock.mock.calls[3][0])).toContain('p.web_subcategory_slug')
    const kitchen = tree.find((node) => node.slug === 'кухня-и-столовая')
    expect(kitchen?.children).toEqual([
      { name: 'Посуда', slug: 'посуда', children: [] },
      { name: 'Сервировка', slug: 'сервировка', children: [] },
    ])
  })
})
