import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery, mockEnv } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockEnv: { catalogSource: 'crm' as 'sheets' | 'crm' },
}))

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: vi.fn(),
  },
}))

import { deleteCrmCategory, listCrmCategories, updateCrmCategory } from './crm-catalog-categories.service'

const emptySubcategorySeo = {
  seoTitle: '',
  seoDescription: '',
  seoH1: '',
  seoIntroTop: '',
  seoTextBottom: '',
}

describe('crm-catalog-categories.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.catalogSource = 'crm'
  })

  it('listCrmCategories uses virtual count for Sale category', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            name: 'Распродажа',
            slug: 'распродажа',
            cover_image_url: null,
            cover_drive_filename: null,
            direct_product_count: 0,
            cross_placement_count: 0,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            category_id: 7,
            id: 70,
            name: 'Legacy Sub',
            slug: 'legacy-sub',
            cover_image_url: null,
            sort_order: 0,
            product_count: 5,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ cnt: 21 }] })

    const items = await listCrmCategories()

    expect(String(mockQuery.mock.calls[2][0])).toContain('discount_percent > 0')
    expect(items).toHaveLength(1)
    expect(items[0].subcategories).toEqual([])
    expect(items[0].directProductCount).toBe(21)
    expect(items[0].productCount).toBe(21)
  })

  it('listCrmCategories merges categories, subcategories, and isUnused', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Used',
            slug: 'used',
            cover_image_url: null,
            cover_drive_filename: null,
            direct_product_count: 2,
            cross_placement_count: 1,
          },
          {
            id: 2,
            name: 'Orphan',
            slug: 'orphan',
            cover_image_url: null,
            cover_drive_filename: null,
            direct_product_count: 0,
            cross_placement_count: 0,
          },
          {
            id: 3,
            name: 'SubOnly',
            slug: 'subonly',
            cover_image_url: null,
            cover_drive_filename: null,
            direct_product_count: 0,
            cross_placement_count: 0,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            category_id: 1,
            id: 10,
            name: 'Dresses',
            slug: 'dresses',
            cover_image_url: null,
            sort_order: 0,
            product_count: 3,
          },
          {
            category_id: 3,
            id: 30,
            name: 'Bags',
            slug: 'bags',
            cover_image_url: 'https://example.com/bags.webp',
            sort_order: 1,
            product_count: 2,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ cnt: 0 }] })

    const items = await listCrmCategories()

    expect(String(mockQuery.mock.calls[0][0])).toContain('product_subcategories')
    expect(items).toHaveLength(3)

    const used = items.find((c) => c.id === 1)!
    expect(used.productCount).toBe(2)
    expect(used.directProductCount).toBe(2)
    expect(used.crossPlacementCount).toBe(1)
    expect(used.subcategories).toEqual([
      {
        id: 10,
        name: 'Dresses',
        slug: 'dresses',
        coverImageUrl: null,
        sortOrder: 0,
        productCount: 3,
        ...emptySubcategorySeo,
      },
    ])
    expect(used.isUnused).toBe(false)

    const orphan = items.find((c) => c.id === 2)!
    expect(orphan.subcategories).toEqual([])
    expect(orphan.isUnused).toBe(true)

    const subOnly = items.find((c) => c.id === 3)!
    expect(subOnly.subcategories).toEqual([
      {
        id: 30,
        name: 'Bags',
        slug: 'bags',
        coverImageUrl: 'https://example.com/bags.webp',
        sortOrder: 1,
        productCount: 2,
        ...emptySubcategorySeo,
      },
    ])
    expect(subOnly.isUnused).toBe(false)

    expect(String(mockQuery.mock.calls[0][0])).toContain('cross_placement_count')
    expect(String(mockQuery.mock.calls[1][0])).toContain('FROM subcategories s')
  })

  it('deleteCrmCategory returns 409 for virtual Sale category', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ name: 'Распродажа' }] })

    await expect(deleteCrmCategory(7)).rejects.toMatchObject({
      message: 'Виртуальную «Распродажу» удалить нельзя.',
      statusCode: 409,
    })
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('deleteCrmCategory returns 409 when category has active products via subcategories', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: 'Used' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })

    await expect(deleteCrmCategory(5)).rejects.toMatchObject({
      message: 'В категории есть активные товары.',
      statusCode: 409,
    })
    expect(String(mockQuery.mock.calls[1][0])).toContain('product_subcategories')
  })

  it('deleteCrmCategory returns 409 when category has active products', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: 'Used' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })

    await expect(deleteCrmCategory(5)).rejects.toMatchObject({
      message: 'В категории есть активные товары.',
      statusCode: 409,
    })
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  it('deleteCrmCategory returns 409 when category has cross placements', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: 'Used' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })

    await expect(deleteCrmCategory(7)).rejects.toMatchObject({
      message: 'Категория используется в веб-кросс-размещениях.',
      statusCode: 409,
    })
    expect(String(mockQuery.mock.calls[2][0])).toContain('product_web_cross_placements')
  })

  it('deleteCrmCategory deletes unused category', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: 'Orphan' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rowCount: 1 })

    const deleted = await deleteCrmCategory(9)

    expect(deleted).toBe(true)
    expect(String(mockQuery.mock.calls[3][0])).toContain('DELETE FROM categories')
  })

  it('deleteCrmCategory returns 409 on foreign key violation', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: 'Orphan' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockRejectedValueOnce(Object.assign(new Error('fk'), { code: '23503' }))

    await expect(deleteCrmCategory(11)).rejects.toMatchObject({
      message: 'Категория связана с другими записями.',
      statusCode: 409,
    })
  })

  it('updateCrmCategory returns 409 when renaming Sale category', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ name: 'Распродажа', slug: 'распродажа' }],
    })

    await expect(updateCrmCategory(7, { name: 'Sale' })).rejects.toMatchObject({
      message: 'Название виртуальной «Распродажи» менять нельзя.',
      statusCode: 409,
    })
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('updateCrmCategory returns 409 when changing Sale slug', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ name: 'Распродажа', slug: 'распродажа' }],
    })

    await expect(updateCrmCategory(7, { slug: 'sale' })).rejects.toMatchObject({
      message: 'Slug виртуальной «Распродажи» менять нельзя.',
      statusCode: 409,
    })
  })

  it('updateCrmCategory allows cover-only patch for Sale category', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ name: 'Распродажа', slug: 'распродажа' }],
      })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            name: 'Распродажа',
            slug: 'распродажа',
            cover_image_url: 'https://example.com/cover.webp',
            cover_drive_filename: null,
            direct_product_count: 0,
            cross_placement_count: 0,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ cnt: 0 }] })

    const updated = await updateCrmCategory(7, {
      coverImageUrl: 'https://example.com/cover.webp',
    })

    expect(updated?.coverImageUrl).toBe('https://example.com/cover.webp')
    expect(String(mockQuery.mock.calls[1][0])).toContain('cover_image_url')
  })

  it('updateCrmCategory writes SEO fields', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: 'Кухня', slug: 'kukhnya' }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            name: 'Кухня',
            slug: 'kukhnya',
            cover_image_url: null,
            cover_drive_filename: null,
            direct_product_count: 1,
            cross_placement_count: 0,
            seo_title: 'Cat SEO title',
            seo_description: 'Cat SEO desc',
            seo_h1: 'Cat H1',
            seo_intro_top: 'Intro',
            seo_text_bottom: 'Bottom',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ cnt: 0 }] })

    await updateCrmCategory(3, {
      seoTitle: 'Cat SEO title',
      seoDescription: 'Cat SEO desc',
      seoH1: 'Cat H1',
      seoIntroTop: 'Intro',
      seoTextBottom: 'Bottom',
    })

    const updateSql = String(mockQuery.mock.calls[1][0])
    expect(updateSql).toContain('seo_title')
    expect(updateSql).toContain('seo_text_bottom')
  })
})
