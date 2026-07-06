import type { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyAdminJwt = vi.fn()

vi.mock('../services/admin-auth.service', () => ({
  verifyAdminJwt: (...args: unknown[]) => mockVerifyAdminJwt(...args),
}))

import { requireCrmAuth } from './require-crm-auth.middleware'

const createMockRes = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }) as unknown as Response

describe('requireCrmAuth', () => {
  let next: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
    next = vi.fn()
  })

  it('returns 401 when admin cookie is missing', () => {
    const req = { cookies: {} } as Request
    const res = createMockRes()

    requireCrmAuth()(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when manager token is used for owner-only route', () => {
    const req = { cookies: { admin_token: 'token' } } as Request
    const res = createMockRes()
    mockVerifyAdminJwt.mockReturnValue({ adminId: 2, role: 'manager' })

    requireCrmAuth(['owner'])(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next for owner token on owner-only route', () => {
    const req = { cookies: { admin_token: 'token' } } as Request & {
      crmAdmin?: { adminId: number; role: 'owner' | 'manager' }
    }
    const res = createMockRes()
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })

    requireCrmAuth(['owner'])(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.crmAdmin).toEqual({ adminId: 1, role: 'owner' })
  })
})
