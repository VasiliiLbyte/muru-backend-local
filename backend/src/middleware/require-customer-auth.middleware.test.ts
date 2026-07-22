import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/env', () => ({
  env: {
    customerJwtSecret: 'customer_jwt_secret_for_tests_0123456789ab',
    customerAccountsEnabled: true,
    adminJwtSecret: 'admin_jwt_secret_for_tests_0123456789abcdef',
  },
}))

vi.mock('../utils/db', () => ({
  pool: { query: vi.fn() },
}))

import { requireCustomerAuth } from './require-customer-auth.middleware'
import { requireCrmAuth } from './require-crm-auth.middleware'
import { signCustomerAccessJwt } from '../services/customer-auth.service'
import { signAdminJwt } from '../services/admin-auth.service'

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }
}

describe('I2 JWT middleware isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requireCustomerAuth rejects admin JWT', () => {
    const adminToken = signAdminJwt({ adminId: 1, role: 'owner' })
    const req = {
      headers: { authorization: `Bearer ${adminToken}` },
    } as unknown as Request
    const res = mockRes()
    const next = vi.fn()

    requireCustomerAuth(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('requireCrmAuth rejects customer JWT (cookie)', () => {
    const customerToken = signCustomerAccessJwt({ customerId: 9 })
    const req = {
      cookies: { admin_token: customerToken },
    } as unknown as Request
    const res = mockRes()
    const next = vi.fn()

    requireCrmAuth()(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('requireCustomerAuth accepts customer JWT', () => {
    const token = signCustomerAccessJwt({ customerId: 9 })
    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as unknown as Request
    const res = mockRes()
    const next = vi.fn()

    requireCustomerAuth(req, res, next)

    expect(next).toHaveBeenCalled()
    expect((req as Request & { customerAuth?: { customerId: number } }).customerAuth?.customerId).toBe(
      9,
    )
  })

  it('requireCustomerAuth rejects JWT signed with wrong secret', () => {
    const forged = jwt.sign({ customerId: 9 }, 'wrong_secret_xxxxxxxxxxxxxxxxxxxxxxx', {
      expiresIn: '15m',
    })
    const req = {
      headers: { authorization: `Bearer ${forged}` },
    } as unknown as Request
    const res = mockRes()
    const next = vi.fn()

    requireCustomerAuth(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })
})
