import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyStockDelta,
  settleOrderStockOnStatusChange,
  StockProductNotFoundError,
} from './stock-movements.service'

describe('applyStockDelta', () => {
  const query = vi.fn()
  const client = { query } as never

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes sale movement with clamped after and actual delta', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: 7, name: 'Ваза', in_stock: 2 }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await applyStockDelta(client, {
      productSku: 'MU0001',
      delta: -5,
      type: 'sale',
      reason: 'Заказ #10',
      orderId: 10,
      actor: { type: 'system' },
    })

    expect(result).toEqual({ before: 2, after: 0 })
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE products SET in_stock'),
      [0, 7],
    )
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO stock_movements'),
      [
        7,
        'MU0001',
        'Ваза',
        -2,
        'sale',
        'Заказ #10',
        10,
        2,
        0,
        'system',
        null,
        null,
      ],
    )
  })

  it('throws when product sku is missing', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    await expect(
      applyStockDelta(client, {
        productSku: 'MISSING',
        delta: -1,
        type: 'sale',
        reason: 'Заказ #1',
        orderId: 1,
        actor: { type: 'system' },
      }),
    ).rejects.toBeInstanceOf(StockProductNotFoundError)
  })

  it('writes adjustment with admin actor', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: 3, name: 'Чаша', in_stock: 4 }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    await applyStockDelta(client, {
      productSku: 'MU0002',
      delta: 6,
      type: 'adjustment',
      reason: 'Ручная корректировка',
      actor: { type: 'admin', adminId: 9, label: 'owner@muru.ru' },
    })

    expect(query.mock.calls[2][1]).toEqual([
      3,
      'MU0002',
      'Чаша',
      6,
      'adjustment',
      'Ручная корректировка',
      null,
      4,
      10,
      'admin',
      9,
      'owner@muru.ru',
    ])
  })
})

describe('settleOrderStockOnStatusChange', () => {
  const query = vi.fn()
  const client = { query } as never

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('restores stock when entering terminal status', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // no existing return
      .mockResolvedValueOnce({
        rows: [{ product_sku: 'MU0001', quantity: 2 }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 7, name: 'Ваза', in_stock: 1 }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    await settleOrderStockOnStatusChange(client, {
      orderId: 42,
      previousStatus: 'Новый',
      newStatus: 'Отменён',
      actor: { type: 'system' },
    })

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("type = 'return'"),
      [42],
    )
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO stock_movements'),
      expect.arrayContaining(['return', 'Возврат по заказу #42', 42]),
    )
  })

  it('no-ops when previous status is already terminal', async () => {
    await settleOrderStockOnStatusChange(client, {
      orderId: 42,
      previousStatus: 'Возврат',
      newStatus: 'Отменён',
      actor: { type: 'system' },
    })
    expect(query).not.toHaveBeenCalled()
  })

  it('no-ops when return movement already exists', async () => {
    query.mockResolvedValueOnce({ rows: [{ exists: 1 }] })

    await settleOrderStockOnStatusChange(client, {
      orderId: 42,
      previousStatus: 'Новый',
      newStatus: 'Возврат',
      actor: { type: 'system' },
    })

    expect(query).toHaveBeenCalledTimes(1)
  })
})
