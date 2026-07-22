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
