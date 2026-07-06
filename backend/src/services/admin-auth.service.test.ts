import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPoolQuery = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
  },
}))

vi.mock('../utils/env', () => ({
  env: {
    adminJwtSecret: 'admin_jwt_secret_for_tests_0123456789abcdef',
  },
}))

import { DUMMY_HASH, login, verifyAdminJwt } from './admin-auth.service'

describe('admin-auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('login happy-path returns token and updates last login', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(true)
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            email: 'owner@example.com',
            password_hash: 'stored_hash',
            role: 'owner',
            is_active: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    const result = await login('  OWNER@example.com ', 'secret')

    expect(mockPoolQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE email = $1'), [
      'owner@example.com',
    ])
    expect(compareSpy).toHaveBeenCalledWith('secret', 'stored_hash')
    expect(mockPoolQuery).toHaveBeenCalledWith(
      'UPDATE admin_users SET last_login_at = NOW() WHERE id = $1',
      [7],
    )
    expect(result?.email).toBe('owner@example.com')
    expect(result?.role).toBe('owner')
    expect(result?.token).toEqual(expect.any(String))
  })

  it('returns null for invalid password', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(false)
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 8,
          email: 'manager@example.com',
          password_hash: 'stored_hash',
          role: 'manager',
          is_active: true,
        },
      ],
    })

    const result = await login('manager@example.com', 'wrong')

    expect(result).toBeNull()
    expect(compareSpy).toHaveBeenCalledWith('wrong', 'stored_hash')
    expect(mockPoolQuery).toHaveBeenCalledTimes(1)
  })

  it('returns null for unknown email and still compares with dummy hash', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(false)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })

    const result = await login('missing@example.com', 'secret')

    expect(result).toBeNull()
    expect(compareSpy).toHaveBeenCalledWith('secret', DUMMY_HASH)
  })

  it('returns null for inactive admin and still compares with dummy hash', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(false)
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 11,
          email: 'owner@example.com',
          password_hash: 'stored_hash',
          role: 'owner',
          is_active: false,
        },
      ],
    })

    const result = await login('owner@example.com', 'secret')

    expect(result).toBeNull()
    expect(compareSpy).toHaveBeenCalledWith('secret', DUMMY_HASH)
  })

  it('verifyAdminJwt returns null for expired or malformed token', () => {
    const expiredToken = jwt.sign(
      { adminId: 5, role: 'owner' },
      'admin_jwt_secret_for_tests_0123456789abcdef',
      { expiresIn: -1 },
    )

    expect(verifyAdminJwt(expiredToken)).toBeNull()
    expect(verifyAdminJwt('broken.token.value')).toBeNull()
  })
})
