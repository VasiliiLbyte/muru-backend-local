import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPoolQuery = vi.fn()
const mockConnect = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
    connect: (...args: unknown[]) => mockConnect(...args),
  },
}))

import {
  deleteAddress,
  getCustomerOrder,
  listAddresses,
  listCustomerOrders,
  updateAddress,
} from './customer-account.service'

describe('customer-account.service ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listCustomerOrders filters by customer_id', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })
    await listCustomerOrders(11)
    expect(mockPoolQuery).toHaveBeenCalledWith(expect.stringContaining('customer_id = $1'), [11])
  })

  it('getCustomerOrder returns 404 for foreign order', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })
    await expect(getCustomerOrder(11, 99)).rejects.toMatchObject({ status: 404 })
  })

  it('getCustomerOrder maps delivery and CDEK fields', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 42,
            status: 'paid',
            total: '1000',
            channel: 'web',
            delivery_mode: 'delivery',
            address: 'Невский 1',
            created_at: '2026-08-01T10:00:00.000Z',
            paid_at: '2026-08-01T10:05:00.000Z',
            cdek_track_number: 'TRACK123',
            cdek_status: 'CREATED',
            cdek_to_city_name: 'Санкт-Петербург',
            cdek_pvz_address: 'ПВЗ на Невском',
            cdek_pvz_code: 'SPB1',
            delivery_price: '450.50',
            delivery_eta: '2-3 дня',
            delivery_option: 'pvz',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            product_sku: 'MU0001',
            product_name: 'Ваза',
            price: '500',
            quantity: 2,
          },
        ],
      })

    const detail = await getCustomerOrder(11, 42)

    expect(detail).toMatchObject({
      id: 42,
      status: 'paid',
      total: 1000,
      channel: 'web',
      deliveryMode: 'delivery',
      address: 'Невский 1',
      trackNumber: 'TRACK123',
      cdekStatus: 'CREATED',
      deliveryCity: 'Санкт-Петербург',
      pvzAddress: 'ПВЗ на Невском',
      pvzCode: 'SPB1',
      deliveryPrice: 450.5,
      deliveryEta: '2-3 дня',
      deliveryOption: 'pvz',
      items: [{ sku: 'MU0001', name: 'Ваза', price: 500, quantity: 2 }],
    })
    expect(mockPoolQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('cdek_track_number'),
      [42, 11],
    )
  })

  it('getCustomerOrder maps null deliveryPrice when SQL price is null', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            status: 'new',
            total: '100',
            channel: 'telegram',
            delivery_mode: 'pickup',
            address: '',
            created_at: '2026-08-01T10:00:00.000Z',
            paid_at: null,
            cdek_track_number: null,
            cdek_status: null,
            cdek_to_city_name: null,
            cdek_pvz_address: null,
            cdek_pvz_code: null,
            delivery_price: null,
            delivery_eta: null,
            delivery_option: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    const detail = await getCustomerOrder(11, 7)
    expect(detail.trackNumber).toBeNull()
    expect(detail.deliveryCity).toBeNull()
    expect(detail.deliveryPrice).toBeNull()
    expect(detail.items).toEqual([])
  })

  it('deleteAddress returns 404 for foreign address', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })
    await expect(deleteAddress(11, 5)).rejects.toMatchObject({ status: 404 })
  })

  it('updateAddress returns 404 when address belongs to another customer', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    }
    mockConnect.mockResolvedValueOnce(client)

    await expect(
      updateAddress(11, 5, { city: 'Spb', address: 'Lenina 1' }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('listAddresses scopes to customer', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })
    await listAddresses(42)
    expect(mockPoolQuery).toHaveBeenCalledWith(expect.stringContaining('customer_id = $1'), [42])
  })
})
