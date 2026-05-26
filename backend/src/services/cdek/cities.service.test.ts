import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  cdekFetch: vi.fn(),
}))

import { cdekFetch } from './client'
import { suggestCities } from './cities.service'

const cdekFetchMock = vi.mocked(cdekFetch)

describe('suggestCities', () => {
  beforeEach(() => {
    cdekFetchMock.mockReset()
  })

  it('returns empty array for short query', async () => {
    expect(await suggestCities('a')).toEqual([])
    expect(cdekFetchMock).not.toHaveBeenCalled()
  })

  it('maps and limits results to 15', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      code: i + 1,
      full_name: `City ${i}`,
      city: `City ${i}`,
      region: 'Region',
      country_code: 'RU',
    }))
    cdekFetchMock.mockResolvedValue(rows)

    const result = await suggestCities('моск')
    expect(result).toHaveLength(15)
    expect(result[0]).toEqual({
      code: 1,
      full_name: 'City 0',
      city: 'City 0',
      region: 'Region',
      country_code: 'RU',
    })
    expect(cdekFetchMock).toHaveBeenCalledWith('/location/suggest/cities', {
      method: 'GET',
      query: { name: 'моск', country_code: 'RU' },
    })
  })

  it('uses cache on repeated query', async () => {
    cdekFetchMock.mockResolvedValue([
      { code: 44, full_name: 'Москва', city: 'Москва', country_code: 'RU' },
    ])
    await suggestCities('москва')
    await suggestCities('москва')
    expect(cdekFetchMock).toHaveBeenCalledTimes(1)
  })
})
