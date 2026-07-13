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

import { deleteCrmCategory, listCrmCategories } from './crm-catalog-categories.service'

describe('crm-catalog-categories.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.catalogSource = 'crm'
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
            name: 'Dresses',
            slug: 'dresses',
            product_count: 3,
          },
          {
            category_id: 3,
            name: 'Bags',
            slug: 'bags',
            product_count: 2,
          },
        ],
      })

    const items = await listCrmCategories()

    expect(String(mockQuery.mock.calls[0][0])).toContain('COUNT(DISTINCT p.id)')
    expect(items).toHaveLength(3)

    const used = items.find((c) => c.id === 1)!
    expect(used.productCount).toBe(2)
    expect(used.directProductCount).toBe(2)
    expect(used.crossPlacementCount).toBe(1)
    expect(used.subcategories).toEqual([
      { name: 'Dresses', slug: 'dresses', productCount: 3 },
    ])
    expect(used.isUnused).toBe(false)

    const orphan = items.find((c) => c.id === 2)!
    expect(orphan.subcategories).toEqual([])
    expect(orphan.isUnused).toBe(true)

    const subOnly = items.find((c) => c.id === 3)!
    expect(subOnly.subcategories).toEqual([{ name: 'Bags', slug: 'bags', productCount: 2 }])
    expect(subOnly.isUnused).toBe(false)

    expect(String(mockQuery.mock.calls[0][0])).toContain('cross_placement_count')
    expect(String(mockQuery.mock.calls[1][0])).toContain('web_subcategory_name')
  })

  it('deleteCrmCategory returns 409 when category has active products', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] })

    await expect(deleteCrmCategory(5)).rejects.toMatchObject({
      message: 'Category has active products',
      statusCode: 409,
    })
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('deleteCrmCategory returns 409 when category has cross placements', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })

    await expect(deleteCrmCategory(7)).rejects.toMatchObject({
      message: 'Category is used in web cross placements',
      statusCode: 409,
    })
    expect(String(mockQuery.mock.calls[1][0])).toContain('product_web_cross_placements')
  })

  it('deleteCrmCategory deletes unused category', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rowCount: 1 })

    const deleted = await deleteCrmCategory(9)

    expect(deleted).toBe(true)
    expect(String(mockQuery.mock.calls[2][0])).toContain('DELETE FROM categories')
  })

  it('deleteCrmCategory returns 409 on foreign key violation', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockRejectedValueOnce(Object.assign(new Error('fk'), { code: '23503' }))

    await expect(deleteCrmCategory(11)).rejects.toMatchObject({
      message: 'Category is referenced by other records',
      statusCode: 409,
    })
  })
})
