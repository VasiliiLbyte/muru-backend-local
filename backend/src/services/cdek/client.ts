import { env } from '../../utils/env'
import type { CdekTokenResponse } from './types'

const log = console

const BASE_URLS = {
  test: 'https://api.edu.cdek.ru/v2',
  production: 'https://api.cdek.ru/v2',
} as const

const DEFAULT_TIMEOUT_MS = 15_000

type Token = { access_token: string; expires_at: number }

let tokenCache: Token | null = null
let tokenPromise: Promise<Token> | null = null

const fetchNewToken = async (): Promise<Token> => {
  const url = `${BASE_URLS[env.cdek.env]}/oauth/token?parameters`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.cdek.clientId,
    client_secret: env.cdek.clientSecret,
  })
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    log.error('[cdek] auth failed', { status: r.status })
    throw new Error(`CDEK auth failed: ${r.status} ${text}`)
  }
  const data = (await r.json()) as CdekTokenResponse
  const expires_at = Date.now() + (data.expires_in - 60) * 1000
  return { access_token: data.access_token, expires_at }
}

const getToken = async (): Promise<string> => {
  if (tokenCache && tokenCache.expires_at > Date.now()) return tokenCache.access_token
  if (tokenPromise) return (await tokenPromise).access_token
  tokenPromise = fetchNewToken()
    .then((t) => {
      tokenCache = t
      return t
    })
    .finally(() => {
      tokenPromise = null
    })
  return (await tokenPromise).access_token
}

export type CdekRequestInit = Omit<RequestInit, 'headers'> & {
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  timeoutMs?: number
}

export class CdekApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    public payload: unknown,
    message: string,
  ) {
    super(message)
    this.name = 'CdekApiError'
  }
}

type CdekErrorPayload = {
  errors?: Array<{ message?: string }>
}

export const cdekFetch = async <T>(path: string, init: CdekRequestInit = {}): Promise<T> => {
  const token = await getToken()
  const url = new URL(`${BASE_URLS[env.cdek.env]}${path}`)
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  }

  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const { query: _query, headers: _headers, timeoutMs: _timeoutMs, ...fetchInit } = init

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    let r: Response
    try {
      r = await fetch(url.toString(), { ...fetchInit, headers, signal: ac.signal })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'network error'
      throw new CdekApiError(0, path, null, message)
    } finally {
      clearTimeout(timer)
    }

    if (r.status === 401 && attempt === 0) {
      tokenCache = null
      const fresh = await getToken()
      headers.Authorization = `Bearer ${fresh}`
      continue
    }

    if ((r.status === 502 || r.status === 503 || r.status === 504) && attempt === 0) {
      await new Promise((res) => setTimeout(res, 800))
      continue
    }

    const text = await r.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = text
    }
    if (!r.ok) {
      const errPayload = payload as CdekErrorPayload
      const msg = errPayload?.errors?.[0]?.message ?? `CDEK ${r.status} ${path}`
      throw new CdekApiError(r.status, path, payload ?? text, msg)
    }
    return payload as T
  }

  throw new CdekApiError(0, path, null, 'retry budget exhausted')
}

/** @internal Reset token cache between tests */
export const resetCdekTokenCacheForTests = () => {
  tokenCache = null
  tokenPromise = null
}
