import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery, mockClientQuery, mockConnect } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockClientQuery: vi.fn(),
  mockConnect: vi.fn(),
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

import {
  getProductCollectionIds,
  setProductCollections,
} from './crm-product-collections.service'

describe('crm-product-collections.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConnect.mockImplementation(async () => ({
      query: (...args: unknown[]) => mockClientQuery(...args),
      release: vi.fn(),
    }))
  })

  it('getProductCollectionIds returns ordered ids', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({
        rows: [{ collection_id: 1 }, { collection_id: 3 }],
      })

    await expect(getProductCollectionIds('  mu0001 ')).resolves.toEqual({
      collectionIds: [1, 3],
    })
    expect(mockQuery.mock.calls[0][1]).toEqual(['MU0001'])
  })

  it('getProductCollectionIds throws 404 for unknown SKU', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ exists: false }] })

    await expect(getProductCollectionIds('MISSING')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('setProductCollections rejects unknown collection with 422 before TX writes', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })

    await expect(setProductCollections('MU0001', [1, 99])).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION',
      message: expect.stringContaining('99'),
    })
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('setProductCollections adds new membership with append sort_order and keeps existing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ exists: true }] }) // product
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }) // collections exist
      .mockResolvedValueOnce({ rows: [{ collection_id: 1 }, { collection_id: 2 }] }) // final fetch

    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ collection_id: 1 }] }) // current
      .mockResolvedValueOnce({ rowCount: 0 }) // DELETE removed
      .mockResolvedValueOnce({ rowCount: 1 }) // INSERT collection 2
      .mockResolvedValueOnce(undefined) // COMMIT

    await expect(setProductCollections('mu0001', [1, 2])).resolves.toEqual({
      collectionIds: [1, 2],
    })

    const insertCall = mockClientQuery.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO content_collection_products'),
    )
    expect(insertCall).toBeTruthy()
    expect(insertCall?.[1]).toEqual([2, 'MU0001'])
    expect(String(insertCall?.[0])).toContain('COALESCE(MAX(sort_order), 0) + 1')

    const updateSort = mockClientQuery.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE content_collection_products'),
    )
    expect(updateSort).toBeUndefined()
  })

  it('setProductCollections is idempotent for the same collectionIds', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ collection_id: 1 }, { collection_id: 2 }] })

    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ collection_id: 1 }, { collection_id: 2 }] })
      .mockResolvedValueOnce({ rowCount: 0 }) // DELETE
      .mockResolvedValueOnce(undefined) // COMMIT

    await setProductCollections('MU0001', [2, 1, 1])

    const inserts = mockClientQuery.mock.calls.filter((call) =>
      String(call[0]).includes('INSERT INTO content_collection_products'),
    )
    expect(inserts).toHaveLength(0)
  })

  it('setProductCollections empty array clears all memberships for SKU', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [] }) // final

    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ collection_id: 5 }] })
      .mockResolvedValueOnce({ rowCount: 1 }) // DELETE all
      .mockResolvedValueOnce(undefined) // COMMIT

    await expect(setProductCollections('MU0001', [])).resolves.toEqual({ collectionIds: [] })

    const deleteCall = mockClientQuery.mock.calls.find(
      (call) =>
        String(call[0]).includes('DELETE FROM content_collection_products') &&
        String(call[0]).includes('WHERE sku = $1') &&
        !String(call[0]).includes('ANY'),
    )
    expect(deleteCall?.[1]).toEqual(['MU0001'])
  })

  it('setProductCollections removes dropped collections', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ collection_id: 2 }] })

    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ collection_id: 1 }, { collection_id: 2 }] })
      .mockResolvedValueOnce({ rowCount: 1 }) // DELETE not in desired
      .mockResolvedValueOnce(undefined) // COMMIT

    await setProductCollections('MU0001', [2])

    const deleteCall = mockClientQuery.mock.calls.find((call) =>
      String(call[0]).includes('NOT (collection_id = ANY'),
    )
    expect(deleteCall?.[1]).toEqual(['MU0001', [2]])
  })
})
