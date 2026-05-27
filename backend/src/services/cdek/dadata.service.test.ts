import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const envState = {
  apiKey: '',
}

vi.mock('../../utils/env', () => ({
  env: {
    dadata: {
      get apiKey() {
        return envState.apiKey
      },
      secretKey: '',
    },
  },
}))

import { __clearDadataCacheForTests, suggestAddresses } from './dadata.service'

const buildOkResponse = () =>
  new Response(
    JSON.stringify({
      suggestions: [
        {
          value: 'г Санкт-Петербург, ул Ординарная, д 16',
          data: {
            city: 'Санкт-Петербург',
            city_with_type: 'г Санкт-Петербург',
            city_fias_id: 'fias-spb',
            street: 'Ординарная',
            street_with_type: 'ул Ординарная',
            house: '16',
            postal_code: '197136',
          },
        },
        {
          value: '',
          data: {},
        },
        {
          value: 'г Санкт-Петербург, ул Ординарная, д 18',
          data: {
            street_with_type: 'ул Ординарная',
            house: '18',
          },
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )

beforeEach(() => {
  envState.apiKey = 'test-token'
  __clearDadataCacheForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('suggestAddresses', () => {
  it('returns [] for queries shorter than 2 chars', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await suggestAddresses('a')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns [] when DADATA_API_KEY is not configured', async () => {
    envState.apiKey = ''
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await suggestAddresses('Ординарная', 'Санкт-Петербург')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps DaData response and includes city filter', async () => {
    const fetchMock = vi.fn(async () => buildOkResponse())
    vi.stubGlobal('fetch', fetchMock)

    const result = await suggestAddresses('Ординарная', 'Санкт-Петербург')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      value: 'г Санкт-Петербург, ул Ординарная, д 16',
      street: 'ул Ординарная',
      house: '16',
      block: undefined,
      flat: undefined,
      postalCode: '197136',
      cityFiasId: 'fias-spb',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('suggestions.dadata.ru')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Token test-token')
    const body = JSON.parse(String(init.body))
    expect(body.query).toBe('Ординарная')
    expect(body.locations).toEqual([{ city: 'Санкт-Петербург' }])
    expect(body.from_bound).toEqual({ value: 'street' })
    expect(body.to_bound).toEqual({ value: 'house' })
  })

  it('uses cache for repeated query+city pair', async () => {
    const fetchMock = vi.fn(async () => buildOkResponse())
    vi.stubGlobal('fetch', fetchMock)

    await suggestAddresses('Ординарная', 'Санкт-Петербург')
    await suggestAddresses('ординарная', 'санкт-петербург')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns [] and does not throw on network error', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down')
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await suggestAddresses('Ординарная', 'Санкт-Петербург')
    expect(result).toEqual([])
  })

  it('returns [] for non-2xx DaData response', async () => {
    const fetchMock = vi.fn(
      async () => new Response('forbidden', { status: 403 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await suggestAddresses('Ординарная', 'Санкт-Петербург')).toEqual([])
  })
})
