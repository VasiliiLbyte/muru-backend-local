import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'

vi.mock('../utils/env', () => ({
  env: {
    adminTelegramIds: [111, 222],
  },
}))

import { requireAdmin } from './admin.middleware'
import type { AuthenticatedRequest } from './auth.middleware'

const createMockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

describe('requireAdmin', () => {
  let next: NextFunction

  beforeEach(() => {
    next = vi.fn()
  })

  it('returns 403 when req.auth is missing', () => {
    const req = { headers: {} } as Request
    const res = createMockRes()

    requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when telegramId is not in admin list', () => {
    const req = {
      headers: { 'x-telegram-user-id': '999' },
      auth: { userId: 1, telegramId: 999 },
    } as AuthenticatedRequest
    const res = createMockRes()

    requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next and overwrites x-telegram-user-id for admin JWT id', () => {
    const req = {
      headers: { 'x-telegram-user-id': '999' },
      auth: { userId: 1, telegramId: 111 },
    } as AuthenticatedRequest
    const res = createMockRes()

    requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.headers['x-telegram-user-id']).toBe('111')
    expect(res.status).not.toHaveBeenCalled()
  })
})
