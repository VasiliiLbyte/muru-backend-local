import { timingSafeEqual } from 'node:crypto'

import type { NextFunction, Request, Response } from 'express'

import { fail } from '../utils/api-response'
import { env } from '../utils/env'

type WindowEntry = { count: number; resetAt: number }

const windows = new Map<string, WindowEntry>()

const pruneExpired = () => {
  const now = Date.now()
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key)
  }
}

/** Constant-time compare; unequal lengths → false. */
export const timingSafeEqualString = (a: string, b: string): boolean => {
  if (!a || !b || a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/
/** Basic IPv6 (including compressed); no DNS. */
const IPV6_RE = /^(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

export const isPlausibleIp = (raw: string): boolean => {
  const value = raw.trim()
  if (!value || value.length > 45) return false
  if (IPV4_RE.test(value)) return true
  if (value.includes(':') && IPV6_RE.test(value)) return true
  return false
}

const headerFirst = (value: string | string[] | undefined): string => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim()
  return ''
}

const lastForwardedHop = (xff: string): string => {
  const parts = xff
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

/**
 * Trusted client IP:
 * 1) valid X-Internal-Proxy-Token + plausible X-Client-IP
 * 2) last non-empty X-Forwarded-For hop (never first)
 * 3) X-Real-IP
 * 4) req.ip / socket / unknown
 */
export const resolveClientIp = (req: Request): string => {
  const expected = env.internalProxyToken
  const provided = headerFirst(req.headers['x-internal-proxy-token'])
  if (expected && timingSafeEqualString(provided, expected)) {
    const clientIpHeader = headerFirst(req.headers['x-client-ip'])
    if (clientIpHeader && isPlausibleIp(clientIpHeader)) {
      return clientIpHeader.trim()
    }
  }

  const forwarded = headerFirst(req.headers['x-forwarded-for'])
  if (forwarded) {
    const last = lastForwardedHop(forwarded)
    if (last) return last
  }

  const realIp = headerFirst(req.headers['x-real-ip'])
  if (realIp) return realIp

  return req.ip || req.socket.remoteAddress || 'unknown'
}

export const clientIp = (req: Request): string => resolveClientIp(req)

export const createRateLimiter =
  (options: { windowMs: number; max: number; keyFn: (req: Request) => string }) =>
  (req: Request, res: Response, next: NextFunction) => {
    pruneExpired()
    const key = options.keyFn(req)
    const now = Date.now()
    let entry = windows.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs }
      windows.set(key, entry)
    }
    entry.count += 1
    if (entry.count > options.max) {
      return fail(res, 429, 'Too many requests', 'RATE_LIMITED')
    }
    return next()
  }

export const rateLimitByIp = (routeKey: string, maxPerMinute: number) =>
  createRateLimiter({
    windowMs: 60_000,
    max: maxPerMinute,
    keyFn: (req) => `${routeKey}:ip:${clientIp(req)}`,
  })

export const rateLimitByUserOrIp = (routeKey: string, maxPerMinute: number) =>
  createRateLimiter({
    windowMs: 60_000,
    max: maxPerMinute,
    keyFn: (req) => {
      const auth = (req as Request & { auth?: { telegramId?: number } }).auth
      if (auth?.telegramId) return `${routeKey}:user:${auth.telegramId}`
      return `${routeKey}:ip:${clientIp(req)}`
    },
  })

/** Test-only: clear in-memory rate-limit windows. */
export const _resetRateLimitWindowsForTests = (): void => {
  windows.clear()
}