import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/env', () => ({
  env: {
    cdek: {
      env: 'test' as const,
      clientId: 'test-id',
      clientSecret: 'test-secret',
      senderCityCode: 44,
      senderAddress: '',
      senderName: '',
      senderPhone: '',
      tariffDoor: 138,
      tariffPvz: 139,
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
})
