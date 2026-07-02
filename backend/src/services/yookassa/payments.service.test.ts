import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/db', () => ({
  pool: { query: vi.fn() },
}))

vi.mock('../../utils/env', () => ({
  env: { yookassa: { enabled: true, returnUrl: 'https://example.com/?pay=check' } },
}))

vi.mock('./client', () => ({
  ykFetch: vi.fn(),
  getYkPayment: vi.fn(),
}))

vi.mock('./pricing.service', () => ({
  computeTrustedPricing: vi.fn(),
}))

vi.mock('./order-from-payment.service', () => ({
  fulfillPaidPayment: vi.fn(),
  markPaymentCanceled: vi.fn(),
}))

import { pool } from '../../utils/db'
import { getYkPayment } from './client'
import { fulfillPaidPayment, markPaymentCanceled } from './order-from-payment.service'
import { getPaymentIntentStatusForUser, getPaymentStatusForUser } from './payments.service'

const poolQueryMock = vi.mocked(pool.query)
const getYkPaymentMock = vi.mocked(getYkPayment)
const fulfillMock = vi.mocked(fulfillPaidPayment)
const cancelMock = vi.mocked(markPaymentCanceled)

describe('getPaymentStatusForUser', () => {
  beforeEach(() => {
    poolQueryMock.mockReset()
    getYkPaymentMock.mockReset()
    fulfillMock.mockReset()
    cancelMock.mockReset()
  })

  it('returns local status when already succeeded', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ status: 'succeeded', order_id: 42, telegram_user_id: '123', channel: 'telegram' }],
    } as never)

    const result = await getPaymentStatusForUser('yk-1', 123)

    expect(result).toEqual({ status: 'succeeded', orderId: 42 })
    expect(getYkPaymentMock).not.toHaveBeenCalled()
  })

  it('self-heals via YooKassa when local status is pending', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ status: 'pending', order_id: null, telegram_user_id: '123', channel: 'telegram' }],
    } as never)
    getYkPaymentMock.mockResolvedValue({
      id: 'yk-1',
      status: 'succeeded',
      paid: true,
      amount: { value: '100.00', currency: 'RUB' },
    })
    fulfillMock.mockResolvedValue(99)

    const result = await getPaymentStatusForUser('yk-1', 123)

    expect(getYkPaymentMock).toHaveBeenCalledWith('yk-1', 'telegram')
    expect(fulfillMock).toHaveBeenCalledWith('yk-1')
    expect(result).toEqual({ status: 'succeeded', orderId: 99 })
  })

  it('marks canceled when YooKassa reports canceled', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ status: 'pending', order_id: null, telegram_user_id: '123', channel: 'telegram' }],
    } as never)
    getYkPaymentMock.mockResolvedValue({
      id: 'yk-1',
      status: 'canceled',
      paid: false,
      amount: { value: '100.00', currency: 'RUB' },
    })
    cancelMock.mockResolvedValue(undefined)

    const result = await getPaymentStatusForUser('yk-1', 123)

    expect(cancelMock).toHaveBeenCalledWith('yk-1')
    expect(result).toEqual({ status: 'canceled', orderId: null })
  })

  it('returns null for wrong user', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ status: 'pending', order_id: null, telegram_user_id: '999', channel: 'telegram' }],
    } as never)

    const result = await getPaymentStatusForUser('yk-1', 123)

    expect(result).toBeNull()
  })
})

describe('getPaymentIntentStatusForUser', () => {
  beforeEach(() => {
    poolQueryMock.mockReset()
  })

  it('returns status and orderId for own intent', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ status: 'succeeded', order_id: 15, telegram_user_id: '123' }],
    } as never)

    const result = await getPaymentIntentStatusForUser(7, 123)

    expect(result).toEqual({ status: 'succeeded', orderId: 15 })
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id=$1'),
      [7],
    )
  })

  it('returns null for wrong user', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ status: 'pending', order_id: null, telegram_user_id: '999' }],
    } as never)

    const result = await getPaymentIntentStatusForUser(7, 123)

    expect(result).toBeNull()
  })
})
