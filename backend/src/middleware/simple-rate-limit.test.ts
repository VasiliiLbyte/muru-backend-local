import type { Request } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/env', () => ({
  env: {
    internalProxyToken: 'proxy-token-for-tests-0123456789abcdef',
  },
}))

import {
  isPlausibleIp,
  rateLimitByIp,
  resolveClientIp,
  timingSafeEqualString,
  _resetRateLimitWindowsForTests,
} from './simple-rate-limit'

const mockReq = (headers: Record<string, string>, extras?: Partial<Request>): Request =>
  ({
    headers,
    ip: extras?.ip,
    socket: extras?.socket ?? { remoteAddress: '127.0.0.1' },
  }) as unknown as Request

describe('resolveClientIp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses last X-Forwarded-For hop, not forged first hop', () => {
    const ip = resolveClientIp(
      mockReq({ 'x-forwarded-for': 'Evil, 203.0.113.10' }),
    )
    expect(ip).toBe('203.0.113.10')
  })

  it('trusts X-Client-IP when internal proxy token is valid', () => {
    const ip = resolveClientIp(
      mockReq({
        'x-internal-proxy-token': 'proxy-token-for-tests-0123456789abcdef',
        'x-client-ip': '198.51.100.1',
        'x-forwarded-for': 'Evil, 203.0.113.10',
      }),
    )
    expect(ip).toBe('198.51.100.1')
  })

  it('ignores X-Client-IP when token is missing', () => {
    const ip = resolveClientIp(
      mockReq({
        'x-client-ip': '198.51.100.1',
        'x-forwarded-for': 'Evil, 203.0.113.10',
      }),
    )
    expect(ip).toBe('203.0.113.10')
  })

  it('ignores X-Client-IP when token is invalid', () => {
    const ip = resolveClientIp(
      mockReq({
        'x-internal-proxy-token': 'wrong-token-xxxxxxxxxxxxxxxxxxxxxxx',
        'x-client-ip': '198.51.100.1',
        'x-forwarded-for': '10.0.0.1, 203.0.113.50',
      }),
    )
    expect(ip).toBe('203.0.113.50')
  })

  it('falls back to X-Real-IP when XFF missing', () => {
    const ip = resolveClientIp(mockReq({ 'x-real-ip': '192.0.2.9' }))
    expect(ip).toBe('192.0.2.9')
  })
})

describe('timingSafeEqualString / isPlausibleIp', () => {
  it('rejects unequal lengths without throwing', () => {
    expect(timingSafeEqualString('abc', 'abcd')).toBe(false)
    expect(timingSafeEqualString('', 'x')).toBe(false)
  })

  it('accepts equal matching strings', () => {
    expect(timingSafeEqualString('same-token-value', 'same-token-value')).toBe(true)
  })

  it('validates basic IPv4 and rejects garbage', () => {
    expect(isPlausibleIp('198.51.100.1')).toBe(true)
    expect(isPlausibleIp('Evil')).toBe(false)
    expect(isPlausibleIp('999.1.1.1')).toBe(false)
  })
})

describe('rateLimitByIp', () => {
  beforeEach(() => {
    _resetRateLimitWindowsForTests()
  })

  it('allows 30 requests then returns 429 on the 31st for account:verify', () => {
    const mw = rateLimitByIp('account:verify', 30)
    const req = mockReq({}, { ip: '203.0.113.50' })
    let nextCount = 0
    const next = () => {
      nextCount += 1
    }
    const status = vi.fn().mockReturnThis()
    const json = vi.fn().mockReturnThis()
    const res = { status, json, headersSent: false } as unknown as import('express').Response

    for (let i = 0; i < 30; i++) {
      mw(req, res, next)
    }
    expect(nextCount).toBe(30)
    expect(status).not.toHaveBeenCalled()

    mw(req, res, next)
    expect(nextCount).toBe(30)
    expect(status).toHaveBeenCalledWith(429)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'RATE_LIMITED' }) }),
    )
  })
})
