import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPoolQuery = vi.fn()
const mockSendVerifyEmail = vi.fn()
const mockSendPasswordResetEmail = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
  },
}))

vi.mock('../utils/env', () => ({
  env: {
    customerJwtSecret: 'customer_jwt_secret_for_tests_0123456789ab',
    customerAccountsEnabled: true,
    customerConsentVersion: '2026-06-03',
    storefrontPublicUrl: 'http://localhost:3000',
    adminJwtSecret: 'admin_jwt_secret_for_tests_0123456789abcdef',
  },
}))

vi.mock('./email.service', () => ({
  EmailNotConfiguredError: class EmailNotConfiguredError extends Error {
    constructor(message?: string) {
      super(message)
      this.name = 'EmailNotConfiguredError'
    }
  },
  EmailSendError: class EmailSendError extends Error {
    constructor(message?: string) {
      super(message)
      this.name = 'EmailSendError'
    }
  },
  sendVerifyEmail: (...args: unknown[]) => mockSendVerifyEmail(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}))

import {
  _resetLoginFailCountsForTests,
  INVALID_CREDENTIALS_MESSAGE,
  changePassword,
  linkGuestOrdersToCustomer,
  loginCustomer,
  normalizeEmail,
  parseOptionalPhone,
  parseRequiredPhone,
  registerCustomer,
  resetPassword,
  signCustomerAccessJwt,
  toCustomerDto,
  verifyCustomerAccessJwt,
  verifyEmailToken,
} from './customer-auth.service'
import { verifyAdminJwt } from './admin-auth.service'

describe('customer-auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetLoginFailCountsForTests()
    mockSendVerifyEmail.mockResolvedValue(undefined)
    mockSendPasswordResetEmail.mockResolvedValue(undefined)
  })

  it('normalizeEmail trims and lowercases', () => {
    expect(normalizeEmail('  A@B.Com ')).toBe('a@b.com')
  })

  it('parseOptionalPhone normalizes RU numbers and rejects invalid', () => {
    expect(parseOptionalPhone('89001234567')).toBe('+79001234567')
    expect(parseOptionalPhone('')).toBeNull()
    expect(parseOptionalPhone(null)).toBeNull()
    expect(() => parseOptionalPhone('123')).toThrow(/Invalid phone/)
  })

  it('parseRequiredPhone requires valid phone', () => {
    expect(parseRequiredPhone('+79001234567')).toBe('+79001234567')
    expect(() => parseRequiredPhone('')).toThrow(/Phone is required/)
  })

  it('toCustomerDto never exposes password_hash', () => {
    const dto = toCustomerDto({
      id: 1,
      email: 'a@b.com',
      passwordHash: 'SECRET_HASH',
      fullName: 'A',
      phone: null,
      phoneVerifiedAt: null,
      emailVerifiedAt: null,
      telegramId: null,
      isActive: true,
      consentAccepted: true,
      consentVersion: '2026-06-03',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: null,
    })
    expect(dto).not.toHaveProperty('password_hash')
    expect(dto).not.toHaveProperty('passwordHash')
    expect(JSON.stringify(dto)).not.toContain('SECRET_HASH')
  })

  it('I2: customer JWT is rejected by verifyAdminJwt', () => {
    const token = signCustomerAccessJwt({ customerId: 42 })
    expect(verifyAdminJwt(token)).toBeNull()
  })

  it('I2: admin JWT is rejected by verifyCustomerAccessJwt', () => {
    const adminToken = jwt.sign(
      { adminId: 1, role: 'owner' },
      'admin_jwt_secret_for_tests_0123456789abcdef',
      { expiresIn: '1h' },
    )
    expect(verifyCustomerAccessJwt(adminToken)).toBeNull()
  })

  it('register creates customer without password_hash in DTO', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] }) // find by email
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            email: 'user@example.com',
            password_hash: 'hashed',
            full_name: 'User',
            phone: null,
            phone_verified_at: null,
            email_verified_at: null,
            telegram_id: null,
            is_active: true,
            consent_accepted: true,
            consent_version: '2026-06-03',
            consent_accepted_at: new Date(),
            created_at: new Date(),
            last_login_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // auth token insert

    const result = await registerCustomer({
      email: ' USER@example.com ',
      password: 'password1',
      fullName: 'User',
      consentAccepted: true,
    })

    expect(result.customer.email).toBe('user@example.com')
    expect(result.customer).not.toHaveProperty('password_hash')
    expect(JSON.stringify(result)).not.toContain('hashed')
    expect(mockSendVerifyEmail).toHaveBeenCalled()
  })

  it('register deletes customer when verify email fails (no orphan)', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 21,
            email: 'orphan@example.com',
            password_hash: 'hashed',
            full_name: 'Orphan',
            phone: null,
            phone_verified_at: null,
            email_verified_at: null,
            telegram_id: null,
            is_active: true,
            consent_accepted: true,
            consent_version: '2026-06-03',
            consent_accepted_at: new Date(),
            created_at: new Date(),
            last_login_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // auth token
      .mockResolvedValueOnce({ rows: [] }) // DELETE

    mockSendVerifyEmail.mockRejectedValueOnce(new Error('SMTP down'))

    await expect(
      registerCustomer({
        email: 'orphan@example.com',
        password: 'password1',
        fullName: 'Orphan',
        consentAccepted: true,
      }),
    ).rejects.toMatchObject({ status: 503 })

    expect(mockPoolQuery).toHaveBeenCalledWith('DELETE FROM customers WHERE id = $1', [21])
  })

  it('login returns same message for unknown email and wrong password', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare')

    mockPoolQuery.mockResolvedValueOnce({ rows: [] })
    await expect(loginCustomer('missing@example.com', 'x', '1.1.1.1')).rejects.toMatchObject({
      message: INVALID_CREDENTIALS_MESSAGE,
      status: 401,
    })

    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          email: 'u@example.com',
          password_hash: 'stored',
          full_name: 'U',
          phone: null,
          phone_verified_at: null,
          email_verified_at: null,
          telegram_id: null,
          is_active: true,
          consent_accepted: true,
          consent_version: '2026-06-03',
          consent_accepted_at: null,
          created_at: new Date(),
          last_login_at: null,
        },
      ],
    })
    compareSpy.mockResolvedValueOnce(false)
    await expect(loginCustomer('u@example.com', 'wrong', '1.1.1.1')).rejects.toMatchObject({
      message: INVALID_CREDENTIALS_MESSAGE,
      status: 401,
    })
  })

  it('verifyEmailToken is one-shot via atomic UPDATE', async () => {
    const verifiedCustomer = {
      id: 5,
      email: 'user@example.com',
      password_hash: 'hashed',
      full_name: 'User',
      phone: null,
      phone_verified_at: null,
      email_verified_at: new Date(),
      telegram_id: null,
      is_active: true,
      consent_accepted: true,
      consent_version: '2026-06-03',
      consent_accepted_at: new Date(),
      created_at: new Date(),
      last_login_at: null,
    }
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ customer_id: 5 }] }) // claim token
      .mockResolvedValueOnce({ rows: [] }) // mark verified
      .mockResolvedValueOnce({ rows: [verifiedCustomer] }) // findCustomerById (verify)
      .mockResolvedValueOnce({ rows: [verifiedCustomer] }) // findCustomerById (link)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // link UPDATE
      .mockResolvedValueOnce({ rows: [] }) // second claim → already used

    await expect(verifyEmailToken('raw-token-value')).resolves.toEqual({ ok: true })
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('SET used_at = NOW()'),
      expect.any(Array),
    )

    await expect(verifyEmailToken('raw-token-value')).rejects.toMatchObject({ status: 400 })
  })

  it('linkGuestOrdersToCustomer is no-op when email is not verified', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 8,
          email: 'guest@example.com',
          password_hash: 'hashed',
          full_name: 'Guest',
          phone: null,
          phone_verified_at: null,
          email_verified_at: null,
          telegram_id: null,
          is_active: true,
          consent_accepted: true,
          consent_version: '2026-06-03',
          consent_accepted_at: new Date(),
          created_at: new Date(),
          last_login_at: null,
        },
      ],
    })

    const linked = await linkGuestOrdersToCustomer(8, 'guest@example.com')
    expect(linked).toBe(0)
    expect(mockPoolQuery).toHaveBeenCalledTimes(1)
    expect(mockPoolQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE orders SET customer_id'),
      expect.anything(),
    )
  })

  it('linkGuestOrdersToCustomer attaches guest orders for verified customer', async () => {
    const verified = {
      id: 8,
      email: 'guest@example.com',
      password_hash: 'hashed',
      full_name: 'Guest',
      phone: null,
      phone_verified_at: null,
      email_verified_at: new Date(),
      telegram_id: null,
      is_active: true,
      consent_accepted: true,
      consent_version: '2026-06-03',
      consent_accepted_at: new Date(),
      created_at: new Date(),
      last_login_at: null,
    }
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [verified] })
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [verified] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    expect(await linkGuestOrdersToCustomer(8, '  Guest@Example.com ')).toBe(2)
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE orders SET customer_id = $1'),
      [8, 'guest@example.com'],
    )
    expect(await linkGuestOrdersToCustomer(8, 'guest@example.com')).toBe(0)
  })

  it('resetPassword rejects when atomic claim returns 0 rows', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })
    await expect(resetPassword('used-token', 'newpass12')).rejects.toMatchObject({ status: 400 })
  })

  it('resetPassword succeeds once then rejects reuse', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ customer_id: 7 }] })
      .mockResolvedValueOnce({ rows: [] }) // password update
      .mockResolvedValueOnce({ rows: [] }) // revoke refresh
      .mockResolvedValueOnce({ rows: [] }) // second claim empty

    await expect(resetPassword('fresh-token', 'newpass12')).resolves.toEqual({ ok: true })
    await expect(resetPassword('fresh-token', 'newpass12')).rejects.toMatchObject({ status: 400 })
  })

  it('changePassword revokes all refresh tokens', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(true)
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            email: 'u@example.com',
            password_hash: 'stored',
            full_name: 'U',
            phone: null,
            phone_verified_at: null,
            email_verified_at: null,
            telegram_id: null,
            is_active: true,
            consent_accepted: true,
            consent_version: '2026-06-03',
            consent_accepted_at: null,
            created_at: new Date(),
            last_login_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // password update
      .mockResolvedValueOnce({ rows: [] }) // revoke

    await expect(changePassword(3, 'oldpass12', 'newpass12')).resolves.toEqual({ ok: true })
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE customer_refresh_tokens SET revoked_at = NOW()'),
      [3],
    )
    compareSpy.mockRestore()
  })
})
