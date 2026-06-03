import { randomUUID } from 'node:crypto'

import { env } from '../../utils/env'

const BASE_URL = 'https://api.yookassa.ru/v3'
const TIMEOUT_MS = 20_000

export class YooKassaError extends Error {
  constructor(
    public status: number,
    public payload: unknown,
    message: string,
  ) {
    super(message)
    this.name = 'YooKassaError'
  }
}

const authHeader = (): string =>
  'Basic ' + Buffer.from(`${env.yookassa.shopId}:${env.yookassa.secretKey}`).toString('base64')

type RequestOptions = {
  method: 'GET' | 'POST'
  path: string
  body?: unknown
  idempotenceKey?: string
}

export const ykFetch = async <T>({ method, path, body, idempotenceKey }: RequestOptions): Promise<T> => {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    'Content-Type': 'application/json',
  }
  if (method === 'POST') {
    headers['Idempotence-Key'] = idempotenceKey ?? randomUUID()
  }
  try {
    const r = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    })
    const text = await r.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = text
    }
    if (!r.ok) {
      const msg =
        (payload as { description?: string } | null)?.description ?? `YooKassa ${r.status} ${path}`
      throw new YooKassaError(r.status, payload, msg)
    }
    return payload as T
  } catch (e) {
    if (e instanceof YooKassaError) throw e
    throw new YooKassaError(0, null, e instanceof Error ? e.message : 'network error')
  } finally {
    clearTimeout(timer)
  }
}

export type YkPayment = {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  paid: boolean
  amount: { value: string; currency: string }
  confirmation?: { type: string; confirmation_url?: string }
  metadata?: Record<string, string>
}

export const getYkPayment = (paymentId: string) =>
  ykFetch<YkPayment>({ method: 'GET', path: `/payments/${paymentId}` })
