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
} from './crm-catalog-subcategories.service'

describe('crm-catalog-subcategories.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.catalogSource = 'crm'
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
      },
    ])
  })

  it('createCrmSubcategory returns 409 under virtual Sale category', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ name: 'Распродажа' }] })

    await expect(createCrmSubcategory(7, { name: 'Bags' })).rejects.toMatchObject({
      message: 'Sale category is virtual and cannot have subcategories',
      statusCode: 409,
    })
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('createCrmSubcategory returns 409 on slug conflict', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: 'Used' }] })
      .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }))

    await expect(createCrmSubcategory(5, { name: 'Bags' })).rejects.toMatchObject({
      message: 'Subcategory with this slug already exists in category',
      statusCode: 409,
    })
  })

  it('deleteCrmSubcategory returns 409 when active products exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] })

    await expect(deleteCrmSubcategory(5, 9)).rejects.toMatchObject({
      message: 'Subcategory has active products',
      statusCode: 409,
    })
    expect(String(mockQuery.mock.calls[0][0])).toContain('product_subcategories')
  })
})
