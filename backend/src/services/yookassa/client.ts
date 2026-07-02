import { randomUUID } from 'node:crypto'

import { env } from '../../utils/env'
import type { OrderChannel } from '../../types/order'

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

const credsFor = (channel: OrderChannel): { shopId: string; secretKey: string } => {
  if (channel === 'web') {
    if (env.yookassa.webShopId && env.yookassa.webSecretKey) {
      return { shopId: env.yookassa.webShopId, secretKey: env.yookassa.webSecretKey }
    }
    if (process.env.NODE_ENV === 'production') {
      throw new YooKassaError(
        0,
        null,
        'YOOKASSA_WEB_SHOP_ID/SECRET_KEY not configured for web channel',
      )
    }
    console.warn('[yookassa] web credentials not set, falling back to primary (dev only)')
  }
  return { shopId: env.yookassa.shopId, secretKey: env.yookassa.secretKey }
}

const authHeader = (channel: OrderChannel): string => {
  const creds = credsFor(channel)
  return 'Basic ' + Buffer.from(`${creds.shopId}:${creds.secretKey}`).toString('base64')
}

type RequestOptions = {
  method: 'GET' | 'POST'
  path: string
  channel: OrderChannel
  body?: unknown
  idempotenceKey?: string
}

export const ykFetch = async <T>({
  method,
  path,
  channel,
  body,
  idempotenceKey,
}: RequestOptions): Promise<T> => {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  const headers: Record<string, string> = {
    Authorization: authHeader(channel),
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

export const getYkPayment = (paymentId: string, channel: OrderChannel) =>
  ykFetch<YkPayment>({ method: 'GET', path: `/payments/${paymentId}`, channel })
