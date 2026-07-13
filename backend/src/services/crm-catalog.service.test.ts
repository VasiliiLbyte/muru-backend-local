import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery, mockEnv } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockEnv: { catalogSource: 'sheets' as 'sheets' | 'crm' },
}))

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}))

import { CatalogLockedError } from './catalog-source.guard'
import { createCrmCatalogProduct, listCrmCatalogProducts } from './crm-catalog.service'

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
})
