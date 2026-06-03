import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/env', () => ({
  env: {
    cdek: {
      env: 'test' as const,
      clientId: 'test-id',
      clientSecret: 'test-secret',
      senderCityCode: 137,
      senderPostalCode: '192102',
      senderAddress: 'г. Санкт-Петербург, ул. Дубровская, 13',
      senderName: '',
      senderPhone: '',
      tariffDoor: 139,
      tariffPvz: 138,
      webhookSecret: '',
    },
  },
}))

import { CdekApiError, cdekFetch, resetCdekTokenCacheForTests } from './client'

describe('CdekApiError', () => {
  it('preserves status, path, and payload', () => {
    const err = new CdekApiError(401, '/oauth/token', { errors: [] }, 'Unauthorized')
    expect(err.status).toBe(401)
    expect(err.path).toBe('/oauth/token')
    expect(err.payload).toEqual({ errors: [] })
    expect(err.message).toBe('Unauthorized')
    expect(err.name).toBe('CdekApiError')
  })
})

describe('cdekFetch token cache', () => {
  afterEach(() => {
    resetCdekTokenCacheForTests()
    vi.unstubAllGlobals()
  })

  it('requests oauth only once for parallel cdekFetch calls', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/oauth/token')) {
        return new Response(
          JSON.stringify({ access_token: 'tok', expires_in: 3600, token_type: 'bearer' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/location/regions')) {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer tok' })
        return new Response(JSON.stringify([{ region: 'RU' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const [a, b] = await Promise.all([
      cdekFetch<unknown[]>('/location/regions', { query: { size: 1 } }),
      cdekFetch<unknown[]>('/location/regions', { query: { size: 1 } }),
    ])

    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    const oauthCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/oauth/token'))
    expect(oauthCalls).toHaveLength(1)
  })

  it('retries once on 503', async () => {
    let regionsCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/oauth/token')) {
        return new Response(
          JSON.stringify({ access_token: 'tok', expires_in: 3600, token_type: 'bearer' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/location/regions')) {
        regionsCalls += 1
        if (regionsCalls === 1) {
          return new Response('bad gateway', { status: 503 })
        }
        return new Response(JSON.stringify([{ region: 'RU' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await cdekFetch<unknown[]>('/location/regions', { query: { size: 1 } })
    expect(result).toHaveLength(1)
    expect(regionsCalls).toBe(2)
  })

  it('logs [cdek-req] and [cdek-resp] when LOG_CDEK_DEBUG=1 on failed request', async () => {
    vi.stubEnv('LOG_CDEK_DEBUG', '1')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/oauth/token')) {
        return new Response(
          JSON.stringify({ access_token: 'tok', expires_in: 3600, token_type: 'bearer' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/calculator/tariff')) {
        return new Response(
          JSON.stringify({
            errors: [{ code: 'err', message: 'fail' }],
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      cdekFetch('/calculator/tariff', { method: 'POST', body: JSON.stringify({ type: 1 }) }),
    ).rejects.toThrow()

    const tags = logSpy.mock.calls.map((c) => c[0])
    expect(tags).toContain('[cdek-req]')
    expect(tags).toContain('[cdek-resp]')
    logSpy.mockRestore()
    vi.unstubAllEnvs()
  })
})
