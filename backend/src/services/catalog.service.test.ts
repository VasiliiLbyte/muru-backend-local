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

import {
  getCatalogProductBySku,
  getCatalogProducts,
  getCatalogTree,
} from './catalog.service'

const baseProductRow = {
  id: 1,
  sku: 'MU0001',
  slug: 'testovyi-tovar',
  name: 'Тестовый товар',
  price: '1000',
  discount_percent: '0',
  in_stock: 5,
  is_gift_guide: false,
  is_new_arrival: false,
  new_arrival_at: null,
  image_url_1: 'https://example.com/1.webp',
  image_url_2: 'https://example.com/1.webp',
  image_urls: ['https://example.com/1.webp'],
  category_name: 'Кухня и столовая',
  subcategory: null,
  subcategory_slug: null,
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
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            ...baseProductRow,
            web_subcategory_name: 'Посуда',
            web_subcategory_slug: 'посуда',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ product_id: 1, slug: 'посуда' }],
      })

    const products = await getCatalogProducts({ channel: 'web' })

    expect(products).toHaveLength(1)
    expect(products[0].subcategory).toBe('Посуда')
    expect(products[0].subcategorySlug).toBe('посуда')
    expect(products[0].webPrimarySubcategory).toEqual({ name: 'Посуда', slug: 'посуда' })
    expect(products[0].webSubcategorySlugs).toEqual(['посуда'])
  })

  it('falls back to CRM subcategory_* when web_* is null (channel=web)', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            ...baseProductRow,
            subcategory: 'Вазы и кувшины',
            subcategory_slug: 'vazy-i-kuvshiny',
            web_subcategory_name: null,
            web_subcategory_slug: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    const products = await getCatalogProducts({ channel: 'web' })

    expect(products[0].subcategory).toBe('Вазы и кувшины')
    expect(products[0].subcategorySlug).toBe('vazy-i-kuvshiny')
    expect(products[0].webPrimarySubcategory).toEqual({
      name: 'Вазы и кувшины',
      slug: 'vazy-i-kuvshiny',
    })
    expect(products[0].webSubcategorySlugs).toBeUndefined()
  })

  it('uses empty subcategory when DB value is null', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...baseProductRow }],
    })

    const products = await getCatalogProducts({})

    expect(products[0].subcategory).toBe('')
    expect(products[0].subcategorySlug).toBeUndefined()
    expect(products[0].giftGuide).toBe(false)
  })

  it('filters gift guide products when giftGuide=true', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({ giftGuide: true })

    const sql = String(queryMock.mock.calls[0][0])
    expect(sql).toContain('p.is_gift_guide = TRUE')
  })

  it('filters new arrival products when newArrival=true', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({ newArrival: true })

    const sql = String(queryMock.mock.calls[0][0])
    expect(sql).toContain('p.is_new_arrival = TRUE')
  })

  it('orders by new_arrival_at when sort=new', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({ sort: 'new' })

    const sql = String(queryMock.mock.calls[0][0])
    expect(sql).toContain('ORDER BY p.new_arrival_at DESC NULLS LAST, p.updated_at DESC')
  })

  it('keeps updated_at order without sort', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({})

    const sql = String(queryMock.mock.calls[0][0])
    expect(sql).toContain('ORDER BY p.updated_at DESC')
    expect(sql).not.toContain('new_arrival_at DESC')
  })

  it('maps newArrival from row', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...baseProductRow, is_new_arrival: true, new_arrival_at: '2026-07-01T00:00:00.000Z' }],
    })

    const products = await getCatalogProducts({})
    expect(products[0].newArrival).toBe(true)
    expect(products[0].newArrivalAt).toBe('2026-07-01T00:00:00.000Z')
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
    expect(sql).toContain('product_subcategories')
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

  it('joins cross placements and filters primary or cross or junction for web channel', async () => {
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
    expect(sql).toContain('product_subcategories ps')
    expect(sql).toContain('s.slug = $2')
    expect(values).toEqual(['кухня-и-столовая', 'сервировка'])
  })

  it('filters web subcategory-only via primary, cross, or junction EXISTS', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({
      channel: 'web',
      subcategorySlug: 'podsvechniki',
    })

    const sql = String(queryMock.mock.calls[0][0])
    expect(sql).toContain('p.web_subcategory_slug = $1')
    expect(sql).toContain('pwcp.subcategory_slug = $1')
    expect(sql).toContain('product_subcategories ps')
    expect(sql).toContain('s.slug = $1')
  })

  it('maps web-only DTO fields when channel=web', async () => {
    queryMock
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        rows: [
          { product_id: 1, slug: 'подсвечники' },
          { product_id: 1, slug: 'сервировка' },
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
    expect(products[0].webSubcategorySlugs).toEqual(['подсвечники', 'сервировка'])
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

  it('filters Sale category by discount_percent for telegram channel', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({ categorySlug: 'rasprodazha' })

    const sql = String(queryMock.mock.calls[0][0])
    expect(sql).toContain('p.discount_percent > 0')
    expect(sql).not.toContain('c.slug =')
  })

  it('filters Sale category by discount_percent for category name', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({ category: 'Распродажа' })

    const sql = String(queryMock.mock.calls[0][0])
    expect(sql).toContain('p.discount_percent > 0')
    expect(sql).not.toContain('c.name ILIKE')
  })

  it('filters Sale category by discount_percent for web channel', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getCatalogProducts({ channel: 'web', categorySlug: 'rasprodazha' })

    const sql = String(queryMock.mock.calls[0][0])
    expect(sql).toContain('p.discount_percent > 0')
    expect(sql).not.toMatch(/WHERE[\s\S]*c\.slug =/)
    expect(sql).not.toMatch(/WHERE[\s\S]*c_cross\.slug/)
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
    queryMock
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        rows: [{ product_id: 1, slug: 'посуда' }],
      })

    const detail = await getCatalogProductBySku('MU0001', 'web')

    expect(detail!.subcategory).toBe('Посуда')
    expect(detail!.subcategorySlug).toBe('посуда')
    expect(detail!.webSubcategorySlugs).toEqual(['посуда'])
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
    queryMock
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        rows: [{ product_id: 1, slug: 'подсвечники' }],
      })

    const detail = await getCatalogProductBySku('MU0001', 'web')

    expect(String(queryMock.mock.calls[0][0])).toContain('product_web_cross_placements pwcp')
    expect(detail!.webPrimarySubcategory).toEqual({
      name: 'Подсвечники',
      slug: 'подсвечники',
    })
    expect(detail!.webCrossPlacement?.categorySlug).toBe('кухня-и-столовая')
    expect(detail!.webSubcategorySlugs).toEqual(['подсвечники'])
  })
})

describe('getCatalogTree', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('does not query product subcategories when withSubcategories is false', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ name: 'Кухня и столовая', slug: 'kukhnya-i-stolovaya' }],
      })
      .mockResolvedValueOnce({ rows: [{ slug: 'kukhnya-i-stolovaya' }] })
      .mockResolvedValueOnce({ rows: [{ ok: false }] })
      .mockResolvedValueOnce({ rows: [] })

    const tree = await getCatalogTree(false)

    expect(queryMock).toHaveBeenCalledTimes(4)
    expect(String(queryMock.mock.calls[2][0])).toContain('discount_percent > 0')
    expect(String(queryMock.mock.calls[3][0])).toContain('cover_image_url')
    expect(tree[0]?.children).toEqual([])
  })

  it('includes Sale node when discounted products exist even without direct category membership', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { name: 'Кухня и столовая', slug: 'kukhnya-i-stolovaya' },
          { name: 'Распродажа', slug: 'rasprodazha' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ slug: 'kukhnya-i-stolovaya' }] })
      .mockResolvedValueOnce({ rows: [{ ok: true }] })
      .mockResolvedValueOnce({ rows: [] })

    const tree = await getCatalogTree(false)

    expect(tree.some((node) => node.slug === 'rasprodazha')).toBe(true)
    expect(tree.some((node) => node.slug === 'kukhnya-i-stolovaya')).toBe(true)
  })

  it('omits Sale node when no discounted products exist', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ name: 'Распродажа', slug: 'rasprodazha' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ok: false }] })
      .mockResolvedValueOnce({ rows: [] })

    const tree = await getCatalogTree(false)

    expect(tree.some((node) => node.slug === 'rasprodazha')).toBe(false)
  })

  it('keeps Sale node children empty when withSubcategories is true', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { name: 'Кухня и столовая', slug: 'kukhnya-i-stolovaya' },
          { name: 'Распродажа', slug: 'rasprodazha' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ slug: 'kukhnya-i-stolovaya' }] })
      .mockResolvedValueOnce({ rows: [{ ok: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            category_slug: 'rasprodazha',
            name: 'Legacy Sale Sub',
            slug: 'legacy-sale-sub',
            cover_image_url: null,
          },
          {
            category_slug: 'kukhnya-i-stolovaya',
            name: 'Посуда',
            slug: 'posuda',
            cover_image_url: null,
          },
        ],
      })

    const tree = await getCatalogTree(true)

    const sale = tree.find((node) => node.slug === 'rasprodazha')
    expect(sale?.children).toEqual([])
    const kitchen = tree.find((node) => node.slug === 'kukhnya-i-stolovaya')
    expect(kitchen?.children).toEqual([
      { name: 'Посуда', slug: 'posuda', children: [] },
    ])
  })

  it('attaches real subcategory children when withSubcategories is true', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ name: 'Кухня и столовая', slug: 'kukhnya-i-stolovaya' }],
      })
      .mockResolvedValueOnce({ rows: [{ slug: 'kukhnya-i-stolovaya' }] })
      .mockResolvedValueOnce({ rows: [{ ok: false }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            category_slug: 'kukhnya-i-stolovaya',
            name: 'Посуда',
            slug: 'posuda',
            cover_image_url: 'https://example.com/posuda.webp',
          },
          {
            category_slug: 'kukhnya-i-stolovaya',
            name: 'Сервировка',
            slug: 'servirovka',
            cover_image_url: null,
          },
        ],
      })

    const tree = await getCatalogTree(true)

    expect(queryMock).toHaveBeenCalledTimes(5)
    expect(String(queryMock.mock.calls[4][0])).toContain('FROM subcategories s')
    expect(String(queryMock.mock.calls[4][0])).toContain('product_subcategories')
    expect(String(queryMock.mock.calls[4][0])).toContain('is_archived = FALSE')
    const kitchen = tree.find((node) => node.slug === 'kukhnya-i-stolovaya')
    expect(kitchen?.children).toEqual([
      {
        name: 'Посуда',
        slug: 'posuda',
        coverImageUrl: 'https://example.com/posuda.webp',
        children: [],
      },
      { name: 'Сервировка', slug: 'servirovka', children: [] },
    ])
  })

  it('excludes empty subcategories from tree when withSubcategories is true', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ name: 'Кухня и столовая', slug: 'kukhnya-i-stolovaya' }],
      })
      .mockResolvedValueOnce({ rows: [{ slug: 'kukhnya-i-stolovaya' }] })
      .mockResolvedValueOnce({ rows: [{ ok: false }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            category_slug: 'kukhnya-i-stolovaya',
            name: 'Посуда',
            slug: 'posuda',
            cover_image_url: 'https://example.com/posuda.webp',
          },
        ],
      })

    const tree = await getCatalogTree(true)
    const kitchen = tree.find((node) => node.slug === 'kukhnya-i-stolovaya')
    expect(kitchen?.children.map((c) => c.slug)).toEqual(['posuda'])
    expect(kitchen?.children.some((c) => c.slug === 'pustaya')).toBe(false)
  })

  it('includes category in tree when products exist only via subcategory membership', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ name: 'Кухня и столовая', slug: 'kukhnya-i-stolovaya' }],
      })
      .mockResolvedValueOnce({ rows: [{ slug: 'kukhnya-i-stolovaya' }] })
      .mockResolvedValueOnce({ rows: [{ ok: false }] })
      .mockResolvedValueOnce({ rows: [] })

    const tree = await getCatalogTree(false)

    expect(String(queryMock.mock.calls[1][0])).toContain('product_subcategories')
    expect(tree.some((node) => node.slug === 'kukhnya-i-stolovaya')).toBe(true)
  })
})

describe('archived products', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('getCatalogProductBySku excludes archived products', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const product = await getCatalogProductBySku('MUARCH')
    expect(product).toBeNull()
    expect(String(queryMock.mock.calls[0][0])).toContain('p.is_archived = FALSE')
  })
})
