import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/env', () => ({
  env: {
    cdek: {
      senderCityCode: 137,
      senderPostalCode: '192102',
      senderAddress: 'г. Санкт-Петербург, ул. Дубровская, 13',
      senderName: 'MURU',
      senderPhone: '+79001112233',
      tariffDoor: 139,
      tariffPvz: 138,
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
  cdek_tariff_code: 139,
  cdek_to_city_code: 137,
  cdek_to_city_name: 'Санкт-Петербург',
  cdek_pvz_code: null,
  cdek_pvz_address: null,
  cdek_recipient_name: null,
  cdek_recipient_phone: null,
  address: 'Невский, 1',
}

const mockOrderQueries = (order: typeof baseOrder) => {
  poolQueryMock
    .mockResolvedValueOnce({ rows: [order] } as never)
    .mockResolvedValueOnce({ rows: [{ full_name: 'Иван', phone: '+79001234567' }] } as never)
    .mockResolvedValueOnce({
      rows: [{ product_sku: 'MU0001', product_name: 'Ваза', price: '1000', quantity: 1 }],
    } as never)
    .mockResolvedValueOnce({
      rows: [
        {
          sku: 'MU0001',
          weight_grams: 3000,
          dim_length_cm: 22,
          dim_width_cm: 12,
          dim_height_cm: 18,
        },
      ],
    } as never)
    .mockResolvedValueOnce({ rows: [] } as never)
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

  it('marks error when pvz tariff but pvz code missing', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ ...baseOrder, cdek_tariff_code: 138, cdek_pvz_code: null }],
    } as never)

    const result = await createCdekOrder(42)
    expect(result).toBeNull()
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("cdek_sync_state = 'error'"),
      expect.arrayContaining([42, 'missing pvz code']),
    )
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

  it('creates door-delivery order with from_location and to_location', async () => {
    mockOrderQueries(baseOrder)
    poolQueryMock.mockResolvedValueOnce({ rows: [] } as never)

    cdekFetchMock.mockResolvedValue({ entity: { uuid: 'cdek-uuid-1' } })

    const result = await createCdekOrder(42)
    expect(result).toEqual({ uuid: 'cdek-uuid-1' })

    const [, init] = cdekFetchMock.mock.calls[0]!
    const body = JSON.parse(String(init?.body))
    expect(body.from_location).toEqual({
      code: 137,
      postal_code: '192102',
      address: 'г. Санкт-Петербург, ул. Дубровская, 13',
    })
    expect(body.to_location).toEqual({ code: 137, address: 'Невский, 1' })
    expect(body.delivery_point).toBeUndefined()
    expect(body.tariff_code).toBe(139)

    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("cdek_sync_state = 'created'"),
      expect.arrayContaining([42, 'cdek-uuid-1']),
    )
  })

  it('creates pvz order with delivery_point, not to_location', async () => {
    mockOrderQueries({
      ...baseOrder,
      cdek_tariff_code: 138,
      cdek_pvz_code: 'SPB123',
      address: '',
    })
    poolQueryMock.mockResolvedValueOnce({ rows: [] } as never)

    cdekFetchMock.mockResolvedValue({ entity: { uuid: 'cdek-uuid-pvz' } })

    const result = await createCdekOrder(42)
    expect(result).toEqual({ uuid: 'cdek-uuid-pvz' })

    const [, init] = cdekFetchMock.mock.calls[0]!
    const body = JSON.parse(String(init?.body))
    expect(body.delivery_point).toBe('SPB123')
    expect(body.to_location).toBeUndefined()
    expect(body.tariff_code).toBe(138)
    expect(body.from_location.postal_code).toBe('192102')
  })

  it('notifies admins on CDEK API error', async () => {
    mockOrderQueries(baseOrder)
    poolQueryMock.mockResolvedValueOnce({ rows: [] } as never)
    poolQueryMock.mockResolvedValueOnce({ rows: [] } as never)

    const apiError = new CdekApiError(400, '/orders', { errors: [] }, 'Bad request')
    cdekFetchMock.mockRejectedValue(apiError)

    await expect(createCdekOrder(42)).rejects.toThrow('Bad request')
    expect(notifyMock).toHaveBeenCalledWith(42, expect.stringContaining('400'))
  })
})
