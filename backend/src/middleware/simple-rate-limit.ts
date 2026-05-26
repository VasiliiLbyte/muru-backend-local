import type { NextFunction, Request, Response } from 'express'

import { fail } from '../utils/api-response'

type WindowEntry = { count: number; resetAt: number }

const windows = new Map<string, WindowEntry>()

const pruneExpired = () => {
  const now = Date.now()
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key)
  }
}

export const clientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown'
  }
  return req.ip || req.socket.remoteAddress || 'unknown'
}

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
