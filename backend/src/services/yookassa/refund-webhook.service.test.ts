import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()
const mockConnect = vi.fn()
const mockClientQuery = vi.fn()
const mockSettle = vi.fn()
const mockNotifyFull = vi.fn()
const mockNotifyPartial = vi.fn()

vi.mock('../../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: (...args: unknown[]) => mockConnect(...args),
  },
}))

vi.mock('../stock-movements.service', () => ({
  settleOrderStockOnStatusChange: (...args: unknown[]) => mockSettle(...args),
}))

vi.mock('../order-notifications.service', () => ({
  notifyAdminsRefundFull: (...args: unknown[]) => mockNotifyFull(...args),
  notifyAdminsRefundPartial: (...args: unknown[]) => mockNotifyPartial(...args),
}))

import { handleRefundSucceeded } from './refund-webhook.service'

describe('handleRefundSucceeded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettle.mockResolvedValue(undefined)
    mockNotifyFull.mockResolvedValue(undefined)
    mockNotifyPartial.mockResolvedValue(undefined)
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: vi.fn(),
    })
  })

  it('full refund updates status, settles stock, and notifies', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, order_id: 42 }] })
      .mockResolvedValueOnce({ rows: [{ id: 42, status: 'Новый', total: '1350' }] })
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FOR UPDATE')) return { rows: [{ status: 'Новый' }] }
      return { rows: [] }
    })

    await handleRefundSucceeded({
      paymentId: 'yk-pay-1',
      refundAmount: '1350.00',
      refundId: 'rf-1',
    })

    expect(mockSettle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: 42,
        previousStatus: 'Новый',
        newStatus: 'Возврат',
        actor: { type: 'system' },
      }),
    )
    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE orders SET status'),
      ['Возврат', 42],
    )
    expect(mockNotifyFull).toHaveBeenCalledWith(42)
    expect(mockNotifyPartial).not.toHaveBeenCalled()
  })

  it('treats 1350.00 refund vs total 1350 as full', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, order_id: 7 }] })
      .mockResolvedValueOnce({ rows: [{ id: 7, status: 'В обработке', total: '1350.00' }] })
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FOR UPDATE')) return { rows: [{ status: 'В обработке' }] }
      return { rows: [] }
    })

    await handleRefundSucceeded({
      paymentId: 'yk-pay-2',
      refundAmount: '1350.00',
    })

    expect(mockSettle).toHaveBeenCalledOnce()
    expect(mockNotifyFull).toHaveBeenCalledWith(7)
  })

  it('partial refund does not settle or update status', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, order_id: 42 }] })
      .mockResolvedValueOnce({ rows: [{ id: 42, status: 'Новый', total: '1350' }] })

    await handleRefundSucceeded({
      paymentId: 'yk-pay-1',
      refundAmount: '100.00',
      refundId: 'rf-partial',
    })

    expect(mockConnect).not.toHaveBeenCalled()
    expect(mockSettle).not.toHaveBeenCalled()
    expect(mockNotifyFull).not.toHaveBeenCalled()
    expect(mockNotifyPartial).toHaveBeenCalledWith(42, 100, 1350)
  })

  it('already terminal is silent no-op without settle or TG', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, order_id: 42 }] })
      .mockResolvedValueOnce({ rows: [{ id: 42, status: 'Возврат', total: '1350.00' }] })
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FOR UPDATE')) return { rows: [{ status: 'Возврат' }] }
      return { rows: [] }
    })

    await handleRefundSucceeded({
      paymentId: 'yk-pay-1',
      refundAmount: '1350.00',
      refundId: 'rf-repeat',
    })

    expect(mockSettle).not.toHaveBeenCalled()
    expect(mockNotifyFull).not.toHaveBeenCalled()
    expect(mockNotifyPartial).not.toHaveBeenCalled()
  })

  it('repeat full after first apply is idempotent via terminal check', async () => {
    // First call: active → settle
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, order_id: 42 }] })
      .mockResolvedValueOnce({ rows: [{ id: 42, status: 'Новый', total: '1350.00' }] })
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FOR UPDATE')) return { rows: [{ status: 'Новый' }] }
      return { rows: [] }
    })

    await handleRefundSucceeded({
      paymentId: 'yk-pay-1',
      refundAmount: '1350.00',
      refundId: 'rf-1',
    })
    expect(mockSettle).toHaveBeenCalledTimes(1)
    expect(mockNotifyFull).toHaveBeenCalledTimes(1)

    // Second call: already Возврат → no-op
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, order_id: 42 }] })
      .mockResolvedValueOnce({ rows: [{ id: 42, status: 'Возврат', total: '1350.00' }] })
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FOR UPDATE')) return { rows: [{ status: 'Возврат' }] }
      return { rows: [] }
    })

    await handleRefundSucceeded({
      paymentId: 'yk-pay-1',
      refundAmount: '1350.00',
      refundId: 'rf-1',
    })

    expect(mockSettle).toHaveBeenCalledTimes(1)
    expect(mockNotifyFull).toHaveBeenCalledTimes(1)
  })

  it('missing payment does not throw', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await expect(
      handleRefundSucceeded({ paymentId: 'missing', refundAmount: '100.00' }),
    ).resolves.toBeUndefined()
    expect(mockSettle).not.toHaveBeenCalled()
  })

  it('payment without order_id does not throw', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, order_id: null }] })
    await expect(
      handleRefundSucceeded({ paymentId: 'yk-orphan', refundAmount: '100.00' }),
    ).resolves.toBeUndefined()
    expect(mockSettle).not.toHaveBeenCalled()
  })
})
