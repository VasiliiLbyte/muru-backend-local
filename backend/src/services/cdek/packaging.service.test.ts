import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/db', () => ({
  pool: { query: vi.fn() },
}))

import { pool } from '../../utils/db'
import { buildPackagesFromCart } from './packaging.service'

const poolQueryMock = vi.mocked(pool.query)

describe('buildPackagesFromCart', () => {
  beforeEach(() => {
    poolQueryMock.mockReset()
  })

  it('returns default package for empty cart', async () => {
    const result = await buildPackagesFromCart([])
    expect(result).toEqual([{ weight: 3000 }])
    expect(poolQueryMock).not.toHaveBeenCalled()
  })

  it('aggregates weight and max dimensions', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [
        {
          sku: 'MU0001',
          weight_grams: 300,
          dim_length_cm: 25,
          dim_width_cm: 15,
          dim_height_cm: 10,
        },
        {
          sku: 'MU0002',
          weight_grams: 400,
          dim_length_cm: 20,
          dim_width_cm: 30,
          dim_height_cm: 12,
        },
      ],
    } as never)

    const result = await buildPackagesFromCart([
      { sku: 'MU0001', quantity: 2 },
      { sku: 'MU0002', quantity: 1 },
    ])

    expect(result).toEqual([{ weight: 1000, length: 25, width: 30, height: 12 }])
  })

  it('uses fallbacks for unknown skus', async () => {
    poolQueryMock.mockResolvedValue({ rows: [] } as never)

    const result = await buildPackagesFromCart([{ sku: 'UNKNOWN', quantity: 1 }])
    expect(result).toEqual([{ weight: 3000, length: 22, width: 12, height: 18 }])
  })
})
