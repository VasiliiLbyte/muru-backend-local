import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/env', () => ({
  env: {
    cdek: {
      senderCityCode: 44,
      tariffDoor: 138,
      tariffPvz: 139,
    },
  },
}))

vi.mock('./client', () => ({
  cdekFetch: vi.fn(),
}))

import { cdekFetch } from './client'
import { calculateBothTariffs, calculateTariff } from './calc.service'

const cdekFetchMock = vi.mocked(cdekFetch)

describe('calculateTariff', () => {
  beforeEach(() => {
    cdekFetchMock.mockReset()
  })

  it('posts type 1 calculator body with min weight 100g', async () => {
    cdekFetchMock.mockResolvedValue({
      tariff_code: 138,
      delivery_sum: 540,
      period_min: 2,
      period_max: 4,
    })

    const result = await calculateTariff({
      tariffCode: 138,
      toCityCode: 137,
      packages: [{ weight: 50, length: 10, width: 10, height: 10 }],
    })

    expect(result.deliverySum).toBe(540)
    const [, init] = cdekFetchMock.mock.calls[0]!
    const body = JSON.parse(String(init?.body))
    expect(body.type).toBe(1)
    expect(body.from_location).toEqual({ code: 44 })
    expect(body.to_location).toEqual({ code: 137 })
    expect(body.packages[0].weight).toBe(100)
  })
})

describe('calculateBothTariffs', () => {
  beforeEach(() => {
    cdekFetchMock.mockReset()
  })

  it('returns door when pvz fails', async () => {
    cdekFetchMock
      .mockResolvedValueOnce({
        tariff_code: 138,
        delivery_sum: 500,
        period_min: 2,
        period_max: 3,
      })
      .mockRejectedValueOnce(new Error('tariff unavailable'))

    const result = await calculateBothTariffs(137, [{ weight: 500 }])
    expect(result.door?.deliverySum).toBe(500)
    expect(result.pvz).toBeNull()
    expect(result.errors).toContain('tariff unavailable')
  })
})
