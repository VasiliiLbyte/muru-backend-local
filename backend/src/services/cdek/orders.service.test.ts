import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/env', () => ({
  env: {
    cdek: {
      senderCityCode: 44,
      senderAddress: 'Sender st 1',
      senderName: 'MURU',
      senderPhone: '+79001112233',
    },
  },
}))

vi.mock('../../utils/db', () => ({
  pool: { query: vi.fn() },
}))

vi.mock('../order-notifications.service', () => ({
  notifyAdminsCdekError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./client', () => ({
  cdekFetch: vi.fn(),
  CdekApiError: class CdekApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      public payload: unknown,
      message: string,
    ) {
      super(message)
      this.name = 'CdekApiError'
    }
  },
}))

import { pool } from '../../utils/db'
import { notifyAdminsCdekError } from '../order-notifications.service'
import { cdekFetch, CdekApiError } from './client'
import { createCdekOrder } from './orders.service'

const poolQueryMock = vi.mocked(pool.query)
const cdekFetchMock = vi.mocked(cdekFetch)
const notifyMock = vi.mocked(notifyAdminsCdekError)

const baseOrder = {
  id: 42,
  telegram_user_id: '123',
  comment: '',
  cdek_tariff_code: 138,
  cdek_to_city_code: 137,
  cdek_to_city_name: 'Санкт-Петербург',
  cdek_pvz_code: null,
  cdek_pvz_address: null,
  cdek_recipient_name: null,
  cdek_recipient_phone: null,
  address: 'Невский, 1',
}

describe('createCdekOrder', () => {
  beforeEach(() => {
    poolQueryMock.mockReset()
    cdekFetchMock.mockReset()
    notifyMock.mockReset()
  })

  it('marks error when tariff or city missing', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ ...baseOrder, cdek_tariff_code: null }],
    } as never)

    const result = await createCdekOrder(42)
    expect(result).toBeNull()
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("cdek_sync_state = 'error'"),
      expect.arrayContaining([42, 'missing tariff/city']),
    )
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('marks error when recipient phone missing', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [baseOrder] } as never)
      .mockResolvedValueOnce({ rows: [{ full_name: 'Test', phone: '' }] } as never)

    const result = await createCdekOrder(42)
    expect(result).toBeNull()
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("cdek_sync_state = 'error'"),
      expect.arrayContaining([42, 'recipient phone missing']),
    )
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('creates order in CDEK and stores uuid', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [baseOrder] } as never)
      .mockResolvedValueOnce({ rows: [{ full_name: 'Иван', phone: '+79001234567' }] } as never)
      .mockResolvedValueOnce({
        rows: [{ product_sku: 'MU0001', product_name: 'Ваза', price: '1000', quantity: 1 }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            sku: 'MU0001',
            weight_grams: 500,
            dim_length_cm: 20,
            dim_width_cm: 20,
            dim_height_cm: 20,
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)

    cdekFetchMock.mockResolvedValue({ entity: { uuid: 'cdek-uuid-1' } })

    const result = await createCdekOrder(42)
    expect(result).toEqual({ uuid: 'cdek-uuid-1' })
    expect(cdekFetchMock).toHaveBeenCalledWith('/orders', expect.objectContaining({ method: 'POST' }))
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("cdek_sync_state = 'created'"),
      expect.arrayContaining([42, 'cdek-uuid-1']),
    )
  })

  it('notifies admins on CDEK API error', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [baseOrder] } as never)
      .mockResolvedValueOnce({ rows: [{ full_name: 'Иван', phone: '+79001234567' }] } as never)
      .mockResolvedValueOnce({
        rows: [{ product_sku: 'MU0001', product_name: 'Ваза', price: '1000', quantity: 1 }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            sku: 'MU0001',
            weight_grams: 500,
            dim_length_cm: 20,
            dim_width_cm: 20,
            dim_height_cm: 20,
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)

    const apiError = new CdekApiError(400, '/orders', { errors: [] }, 'Bad request')
    cdekFetchMock.mockRejectedValue(apiError)

    await expect(createCdekOrder(42)).rejects.toThrow('Bad request')
    expect(notifyMock).toHaveBeenCalledWith(42, expect.stringContaining('400'))
  })
})
