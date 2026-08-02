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
import {
  getPaymentIntentStatusForUser,
  getPaymentStatusForUser,
  getWebPaymentStatus,
} from './payments.service'

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

describe('getWebPaymentStatus', () => {
  beforeEach(() => {
    poolQueryMock.mockReset()
    getYkPaymentMock.mockReset()
    fulfillMock.mockReset()
    cancelMock.mockReset()
  })

  it('returns order summary when succeeded with order_id', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{ status: 'succeeded', order_id: 42 }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 42,
            subtotal: '1000.00',
            delivery_price: '350.00',
            total: '1350.00',
            delivery_mode: 'delivery',
            delivery_option: 'ПВЗ',
            cdek_pvz_address: 'Невский 1',
            address: '',
            cdek_recipient_name: 'Иван',
            delivery_eta: '3-5 дней',
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            product_name: 'Ваза',
            quantity: 1,
            price: '1000.00',
            color: 'белый',
            size: 'M',
          },
        ],
      } as never)

    const result = await getWebPaymentStatus('yk-web-1')

    expect(result).toEqual({
      status: 'succeeded',
      orderId: 42,
      order: {
        id: 42,
        items: [{ name: 'Ваза', quantity: 1, price: 1000, color: 'белый', size: 'M' }],
        subtotal: 1000,
        deliveryPrice: 350,
        total: 1350,
        deliveryMode: 'delivery',
        deliveryOption: 'ПВЗ',
        cdekPvzAddress: 'Невский 1',
        address: '',
        recipientName: 'Иван',
        deliveryEta: '3-5 дней',
      },
    })
  })

  it('omits order when pending without order_id', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ status: 'pending', order_id: null }],
    } as never)
    getYkPaymentMock.mockResolvedValue({
      id: 'yk-web-2',
      status: 'pending',
      paid: false,
      amount: { value: '100.00', currency: 'RUB' },
    })

    const result = await getWebPaymentStatus('yk-web-2')

    expect(result).toEqual({ status: 'pending', orderId: null })
    expect(result).not.toHaveProperty('order')
  })

  it('self-heals and returns order summary after fulfill', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{ status: 'pending', order_id: null }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 99,
            subtotal: '500.00',
            delivery_price: '0.00',
            total: '500.00',
            delivery_mode: 'pickup',
            delivery_option: null,
            cdek_pvz_address: null,
            address: 'Самовывоз',
            cdek_recipient_name: 'Анна',
            delivery_eta: null,
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            product_name: 'Чаша',
            quantity: 2,
            price: '250.00',
            color: null,
            size: null,
          },
        ],
      } as never)

    getYkPaymentMock.mockResolvedValue({
      id: 'yk-web-3',
      status: 'succeeded',
      paid: true,
      amount: { value: '500.00', currency: 'RUB' },
    })
    fulfillMock.mockResolvedValue(99)

    const result = await getWebPaymentStatus('yk-web-3')

    expect(fulfillMock).toHaveBeenCalledWith('yk-web-3')
    expect(result).toEqual({
      status: 'succeeded',
      orderId: 99,
      order: {
        id: 99,
        items: [{ name: 'Чаша', quantity: 2, price: 250, color: null, size: null }],
        subtotal: 500,
        deliveryPrice: 0,
        total: 500,
        deliveryMode: 'pickup',
        deliveryOption: null,
        cdekPvzAddress: null,
        address: 'Самовывоз',
        recipientName: 'Анна',
        deliveryEta: null,
      },
    })
  })
})
