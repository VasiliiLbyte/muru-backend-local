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

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return {
    ...actual,
    cdekFetch: vi.fn(),
  }
})

import { CdekApiError, cdekFetch } from './client'
import {
  calculateBothTariffs,
  calculateTariff,
  fetchAvailableTariffs,
  formatCdekErrors,
} from './calc.service'

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

describe('formatCdekErrors', () => {
  it('joins payload.errors code and message for CdekApiError', () => {
    const err = new CdekApiError(
      400,
      '/calculator/tariff',
      {
        errors: [
          { code: 'v2_internal_error', message: 'Internal Error' },
          { code: 'err_param', message: 'Bad tariff' },
        ],
      },
      'Internal Error',
    )
    expect(formatCdekErrors(err)).toBe(
      'v2_internal_error: Internal Error; err_param: Bad tariff',
    )
  })

  it('falls back to status and message when payload has no errors', () => {
    const err = new CdekApiError(502, '/calculator/tariff', null, 'bad gateway')
    expect(formatCdekErrors(err)).toBe('502: bad gateway')
  })
})

describe('fetchAvailableTariffs', () => {
  beforeEach(() => {
    cdekFetchMock.mockReset()
  })

  it('maps tarifflist response to TariffListItem', async () => {
    cdekFetchMock.mockResolvedValue({
      tariff_codes: [
        {
          tariff_code: 136,
          tariff_name: 'Посылка склад-склад',
          tariff_description: 'PVZ',
          delivery_sum: 350,
          period_min: 2,
          period_max: 4,
        },
      ],
    })

    const list = await fetchAvailableTariffs(137, [{ weight: 500 }])
    expect(list).toEqual([
      {
        tariffCode: 136,
        tariffName: 'Посылка склад-склад',
        tariffDescription: 'PVZ',
        deliverySum: 350,
        periodMin: 2,
        periodMax: 4,
      },
    ])
    const [, init] = cdekFetchMock.mock.calls[0]!
    expect(init?.method).toBe('POST')
    const body = JSON.parse(String(init?.body))
    expect(body.to_location).toEqual({ code: 137 })
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
