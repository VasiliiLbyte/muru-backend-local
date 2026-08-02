import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}))

import {
  CrmStockValidationError,
  listStockMovements,
} from './crm-stock.service'

describe('listStockMovements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mapped rows with default pagination', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            created_at: '2026-08-01T12:00:00.000Z',
            product_id: 3,
            product_sku: 'MU0001',
            product_name: 'Ваза',
            type: 'sale',
            delta: -1,
            stock_after: 4,
            reason: 'Заказ #42',
            order_id: 42,
            actor_type: 'system',
            actor_admin_id: null,
            actor_label: null,
          },
        ],
      })

    const result = await listStockMovements({})

    expect(result).toEqual({
      total: 1,
      page: 1,
      pageSize: 20,
      rows: [
        {
          id: 10,
          createdAt: '2026-08-01T12:00:00.000Z',
          productId: 3,
          productSku: 'MU0001',
          productName: 'Ваза',
          type: 'sale',
          delta: -1,
          stockAfter: 4,
          reason: 'Заказ #42',
          orderId: 42,
          actorType: 'system',
          actorAdminId: null,
          actorLabel: null,
        },
      ],
    })
  })

  it('applies q and type filters in WHERE', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await listStockMovements({ q: 'MU00', type: 'return', page: 2, pageSize: 10 })

    const countSql = String(mockQuery.mock.calls[0][0])
    const countParams = mockQuery.mock.calls[0][1] as unknown[]
    expect(countSql).toContain('product_sku ILIKE')
    expect(countSql).toContain('type =')
    expect(countParams).toEqual(['%MU00%', 'return'])

    const listParams = mockQuery.mock.calls[1][1] as unknown[]
    expect(listParams).toEqual(['%MU00%', 'return', 10, 10])
  })

  it('throws on invalid type', async () => {
    await expect(listStockMovements({ type: 'bogus' })).rejects.toBeInstanceOf(
      CrmStockValidationError,
    )
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
