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
  },
}))

import {
  createCrmSubcategory,
  deleteCrmSubcategory,
  listCrmSubcategories,
  updateCrmSubcategory,
  withCoverCacheBust,
} from './crm-catalog-subcategories.service'
import { invalidateImageCache } from './image-proxy.service'

vi.mock('./image-proxy.service', () => ({
  invalidateImageCache: vi.fn(async () => undefined),
}))

describe('crm-catalog-subcategories.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.catalogSource = 'crm'
  })

  it('withCoverCacheBust appends v= and replaces prior v', () => {
    expect(withCoverCacheBust('https://drive.google.com/thumbnail?id=abc&sz=w1600', 1700000000000)).toContain(
      'v=1700000000000',
    )
    expect(withCoverCacheBust('https://example.com/img.webp?v=1', 99)).toBe(
      'https://example.com/img.webp?v=99',
    )
    expect(withCoverCacheBust('/img/fileId', 42)).toBe('/img/fileId?v=42')
  })

  it('listCrmSubcategories returns mapped rows ordered by sort_order', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          category_id: 5,
          name: 'Bags',
          slug: 'bags',
          cover_image_url: null,
          sort_order: 0,
          product_count: 2,
        },
      ],
    })

    const items = await listCrmSubcategories(5)

    expect(String(mockQuery.mock.calls[0][0])).toContain('FROM subcategories s')
    expect(items).toEqual([
      {
        id: 1,
        categoryId: 5,
        name: 'Bags',
        slug: 'bags',
        coverImageUrl: null,
        sortOrder: 0,
        productCount: 2,
        seoTitle: '',
        seoDescription: '',
        seoH1: '',
        seoIntroTop: '',
        seoTextBottom: '',
      },
    ])
  })

  it('createCrmSubcategory returns 409 under virtual Sale category', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ name: 'Распродажа' }] })

    await expect(createCrmSubcategory(7, { name: 'Bags' })).rejects.toMatchObject({
      message: 'У виртуальной «Распродажи» не бывает подкатегорий.',
      statusCode: 409,
    })
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('createCrmSubcategory returns 409 when slug matches top category', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: 'Текстиль' }] })
      .mockResolvedValueOnce({ rows: [{ ok: 1 }] })

    await expect(createCrmSubcategory(5, { name: 'Кухня и столовая' })).rejects.toMatchObject({
      message: 'Slug совпадает с категорией верхнего уровня. Выберите другое название.',
      statusCode: 409,
    })
    expect(String(mockQuery.mock.calls[1][0])).toContain('FROM categories WHERE slug')
  })

  it('createCrmSubcategory returns 409 on slug conflict', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: 'Used' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }))

    await expect(createCrmSubcategory(5, { name: 'Bags' })).rejects.toMatchObject({
      message: 'Подкатегория с таким slug уже есть в этой категории.',
      statusCode: 409,
    })
  })

  it('updateCrmSubcategory returns 409 when renamed slug matches top category', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ok: 1 }] })

    await expect(
      updateCrmSubcategory(5, 9, { name: 'Кухня и столовая' }),
    ).rejects.toMatchObject({
      message: 'Slug совпадает с категорией верхнего уровня. Выберите другое название.',
      statusCode: 409,
    })
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('updateCrmSubcategory versions Drive cover and invalidates cache', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            category_id: 5,
            name: 'Bags',
            slug: 'bags',
            cover_image_url: 'https://drive.google.com/thumbnail?id=abc123&sz=w1600&v=1',
            sort_order: 0,
            product_count: 0,
          },
        ],
      })

    const updated = await updateCrmSubcategory(5, 9, {
      coverImageUrl: 'https://drive.google.com/thumbnail?id=abc123&sz=w1600',
    })

    const updateSql = String(mockQuery.mock.calls[0][0])
    const updateParams = mockQuery.mock.calls[0][1] as unknown[]
    expect(updateSql).toContain('cover_image_url')
    expect(String(updateParams[0])).toContain('v=')
    expect(updated?.coverImageUrl).toContain('v=')
    expect(invalidateImageCache).toHaveBeenCalledWith(['abc123'])
  })

  it('updateCrmSubcategory versions crm_ cover without invalidating cache', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            category_id: 5,
            name: 'Bags',
            slug: 'bags',
            cover_image_url:
              'https://drive.google.com/thumbnail?id=crm_deadbeef012345&sz=w1600&v=99',
            sort_order: 0,
            product_count: 0,
          },
        ],
      })

    const updated = await updateCrmSubcategory(5, 9, {
      coverImageUrl: 'https://drive.google.com/thumbnail?id=crm_deadbeef012345&sz=w1600',
    })

    const updateParams = mockQuery.mock.calls[0][1] as unknown[]
    expect(String(updateParams[0])).toContain('v=')
    expect(String(updateParams[0])).toContain('crm_deadbeef012345')
    expect(updated?.coverImageUrl).toContain('v=')
    expect(invalidateImageCache).not.toHaveBeenCalled()
  })

  it('updateCrmSubcategory writes SEO fields', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            category_id: 5,
            name: 'Bags',
            slug: 'bags',
            cover_image_url: null,
            sort_order: 0,
            product_count: 2,
            seo_title: 'Sub SEO',
            seo_description: 'Sub desc',
            seo_h1: 'Sub H1',
            seo_intro_top: 'Top',
            seo_text_bottom: 'Bottom',
          },
        ],
      })

    await updateCrmSubcategory(5, 9, {
      seoTitle: 'Sub SEO',
      seoDescription: 'Sub desc',
      seoH1: 'Sub H1',
      seoIntroTop: 'Top',
      seoTextBottom: 'Bottom',
    })

    const updateSql = String(mockQuery.mock.calls[0][0])
    expect(updateSql).toContain('seo_title')
    expect(updateSql).toContain('seo_intro_top')
  })

  it('deleteCrmSubcategory returns 409 when active products exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] })

    await expect(deleteCrmSubcategory(5, 9)).rejects.toMatchObject({
      message: 'В подкатегории есть активные товары.',
      statusCode: 409,
    })
    expect(String(mockQuery.mock.calls[0][0])).toContain('product_subcategories')
  })
})
