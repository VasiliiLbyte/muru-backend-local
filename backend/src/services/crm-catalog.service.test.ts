import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery, mockEnv, mockClientQuery, mockConnect } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockEnv: { catalogSource: 'sheets' as 'sheets' | 'crm' },
  mockClientQuery: vi.fn(),
  mockConnect: vi.fn(),
}))

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: (...args: unknown[]) => mockConnect(...args),
  },
}))

mockConnect.mockImplementation(async () => ({
  query: (...args: unknown[]) => mockClientQuery(...args),
  release: vi.fn(),
}))

import { CatalogLockedError } from './catalog-source.guard'
import {
  renameCrmSubcategory,
} from './crm-catalog-categories.service'
import { createCrmCharacteristic } from './crm-catalog-characteristics.service'
import { createCrmCatalogProduct, listCrmCatalogProducts, updateCrmCatalogProduct } from './crm-catalog.service'

describe('crm-catalog.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.catalogSource = 'sheets'
  })

  it('list applies archived=false and inStock filters', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmCatalogProducts({ inStock: 'in', archived: 'false', q: 'MU' })

    const countSql = String(mockQuery.mock.calls[0][0])
    const countParams = mockQuery.mock.calls[0][1] as unknown[]
    expect(countSql).toContain('p.is_archived = FALSE')
    expect(countSql).toContain('p.in_stock > 0')
    expect(countSql).toContain('p.sku ILIKE')
    expect(countParams[0]).toBe('%MU%')
  })

  it('create throws CatalogLockedError in sheets mode', async () => {
    await expect(
      createCrmCatalogProduct({ sku: 'MU9999', name: 'Test', price: 100 }),
    ).rejects.toBeInstanceOf(CatalogLockedError)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('renameCrmSubcategory updates products in transaction', async () => {
    mockEnv.catalogSource = 'crm'
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await renameCrmSubcategory({
      categoryId: 3,
      oldSubcategoryName: 'Old Sub',
      newSubcategoryName: 'New Sub',
    })

    expect(result.updatedCount).toBe(2)
    const updateSql = String(mockClientQuery.mock.calls[1][0])
    expect(updateSql).toContain('web_subcategory_name')
    expect(updateSql).toContain('ILIKE')
  })

  it('createCrmCharacteristic throws on unique violation', async () => {
    mockEnv.catalogSource = 'crm'
    const pgError = Object.assign(new Error('duplicate'), { code: '23505' })
    mockQuery.mockRejectedValueOnce(pgError)

    await expect(createCrmCharacteristic({ name: 'Material' })).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('createCrmCatalogProduct returns 409 when assigning virtual Sale category', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: 'Распродажа' }] })

    await expect(
      createCrmCatalogProduct({
        sku: 'MU9999',
        name: 'Test',
        price: 100,
        categoryId: 7,
      }),
    ).rejects.toMatchObject({
      message: 'Cannot assign a product directly to the virtual Sale category',
      statusCode: 409,
    })
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  it('updateCrmCatalogProduct returns 409 when assigning virtual Sale category', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery.mockResolvedValueOnce({ rows: [{ name: 'Распродажа' }] })

    await expect(
      updateCrmCatalogProduct(1, { categoryId: 7 }),
    ).rejects.toMatchObject({
      message: 'Cannot assign a product directly to the virtual Sale category',
      statusCode: 409,
    })
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })
})
