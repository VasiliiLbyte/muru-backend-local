import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPoolQuery = vi.fn()
const mockSendVerifyEmail = vi.fn()
const mockSendPasswordResetEmail = vi.fn()
const mockSendAlreadyRegisteredEmail = vi.fn()

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
  sendAlreadyRegisteredEmail: (...args: unknown[]) => mockSendAlreadyRegisteredEmail(...args),
}))

import {
  _resetEmailSendCountsForTests,
  _resetLoginFailCountsForTests,
  INVALID_CREDENTIALS_MESSAGE,
  changePassword,
  forgotPassword,
  linkGuestOrdersToCustomer,
  loginCustomer,
  normalizeEmail,
  parseOptionalPhone,
  parseRequiredPhone,
  recordLoginFailure,
  refreshCustomerSession,
  registerCustomer,
  requiresCaptchaForLogin,
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
    _resetEmailSendCountsForTests()
    mockSendVerifyEmail.mockResolvedValue(undefined)
    mockSendPasswordResetEmail.mockResolvedValue(undefined)
    mockSendAlreadyRegisteredEmail.mockResolvedValue(undefined)
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
      lastName: '',
      firstName: 'A',
      middleName: '',
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

  it('verifyCustomerAccessJwt rejects alg=none token', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ customerId: 1 })).toString('base64url')
    expect(verifyCustomerAccessJwt(`${header}.${payload}.`)).toBeNull()
  })

  it('register creates customer and returns ok without customer body', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] }) // find by email
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            email: 'user@example.com',
            password_hash: 'hashed',
            full_name: 'User',
            last_name: '',
            first_name: "User",
            middle_name: '',
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

    expect(result).toEqual({ ok: true })
    expect(JSON.stringify(result)).not.toContain('hashed')
    expect(mockSendVerifyEmail).toHaveBeenCalled()
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO customers'),
      expect.arrayContaining(['', 'User', '', 'User']),
    )
  })

  it('register with lastName/firstName/middleName persists parts and derived full_name', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            email: 'parts@example.com',
            password_hash: 'hashed',
            full_name: 'Иванов Иван Петрович',
            last_name: 'Иванов',
            first_name: 'Иван',
            middle_name: 'Петрович',
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
      .mockResolvedValueOnce({ rows: [] })

    await registerCustomer({
      email: 'parts@example.com',
      password: 'password1',
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Петрович',
      consentAccepted: true,
    })

    const insertCall = mockPoolQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO customers'))
    expect(insertCall?.[1]).toEqual([
      'parts@example.com',
      expect.any(String),
      'Иванов',
      'Иван',
      'Петрович',
      'Иванов Иван Петрович',
      null,
      '2026-06-03',
    ])
  })

  it('register legacy fullName splits into name parts', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 12,
            email: 'legacy@example.com',
            password_hash: 'hashed',
            full_name: 'Иванов Иван Петрович',
            last_name: 'Иванов',
            first_name: 'Иван',
            middle_name: 'Петрович',
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
      .mockResolvedValueOnce({ rows: [] })

    await registerCustomer({
      email: 'legacy@example.com',
      password: 'password1',
      fullName: 'Иванов Иван Петрович',
      consentAccepted: true,
    })

    const insertCall = mockPoolQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO customers'))
    expect(insertCall?.[1]).toEqual([
      'legacy@example.com',
      expect.any(String),
      'Иванов',
      'Иван',
      'Петрович',
      'Иванов Иван Петрович',
      null,
      '2026-06-03',
    ])
  })

  it('register existing vs new email returns identical { ok: true }', async () => {
    const existingRow = {
      id: 5,
      email: 'taken@example.com',
      password_hash: 'stored-hash',
      full_name: 'Taken',
            last_name: '',
            first_name: "Taken",
            middle_name: '',
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

    mockPoolQuery.mockResolvedValueOnce({ rows: [existingRow] })
    const occupied = await registerCustomer({
      email: 'taken@example.com',
      password: 'password1',
      fullName: 'Attacker',
      consentAccepted: true,
    })
    expect(occupied).toEqual({ ok: true })
    expect(mockSendAlreadyRegisteredEmail).toHaveBeenCalledWith('taken@example.com')
    expect(mockSendVerifyEmail).not.toHaveBeenCalled()
    expect(mockPoolQuery.mock.calls.some((c) => String(c[0]).includes('INSERT INTO customers'))).toBe(
      false,
    )

    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...existingRow,
            id: 6,
            email: 'fresh@example.com',
            email_verified_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    const created = await registerCustomer({
      email: 'fresh@example.com',
      password: 'password1',
      fullName: 'Fresh',
      consentAccepted: true,
    })
    expect(created).toEqual({ ok: true })
    expect(created).toEqual(occupied)
    expect(mockSendVerifyEmail).toHaveBeenCalled()
  })

  it('register occupied path still returns ok when already-registered mail fails', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 5,
          email: 'taken@example.com',
          password_hash: 'stored',
          full_name: 'Taken',
            last_name: '',
            first_name: "Taken",
            middle_name: '',
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
        },
      ],
    })
    mockSendAlreadyRegisteredEmail.mockRejectedValueOnce(new Error('SMTP down'))

    await expect(
      registerCustomer({
        email: 'taken@example.com',
        password: 'password1',
        fullName: 'X',
        consentAccepted: true,
      }),
    ).resolves.toEqual({ ok: true })
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
            last_name: '',
            first_name: "Orphan",
            middle_name: '',
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
            last_name: '',
            first_name: "U",
            middle_name: '',
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
            last_name: '',
            first_name: "User",
            middle_name: '',
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
            last_name: '',
            first_name: "Guest",
            middle_name: '',
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
            last_name: '',
            first_name: "Guest",
            middle_name: '',
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
            last_name: '',
            first_name: "U",
            middle_name: '',
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

  it('requires captcha after 3 fails with rotating IPs on the same email', async () => {
    const email = 'rotate@example.com'
    recordLoginFailure('1.1.1.1', email)
    recordLoginFailure('2.2.2.2', email)
    recordLoginFailure('3.3.3.3', email)
    expect(requiresCaptchaForLogin('9.9.9.9', email)).toBe(true)
    expect(requiresCaptchaForLogin('9.9.9.9', 'other@example.com')).toBe(false)
  })

  it('forgotPassword returns 429 on 6th send for the same email', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] })
    for (let i = 0; i < 5; i++) {
      await expect(forgotPassword('limit@example.com')).resolves.toEqual({ ok: true })
    }
    await expect(forgotPassword('limit@example.com')).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    })
  })

  describe('refreshCustomerSession atomic rotation', () => {
    const customerRow = {
      id: 11,
      email: 'u@example.com',
      password_hash: 'hashed',
      full_name: 'User',
            last_name: '',
            first_name: "User",
            middle_name: '',
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

    const isAtomicClaim = (sql: string) =>
      sql.includes('UPDATE customer_refresh_tokens') &&
      sql.includes('RETURNING id, customer_id') &&
      sql.includes('revoked_at IS NULL') &&
      sql.includes('expires_at > NOW()')

    const isReuseLookup = (sql: string) =>
      sql.includes('SELECT id, customer_id, revoked_at, expires_at') &&
      sql.includes('FROM customer_refresh_tokens')

    const isMassRevoke = (sql: string) =>
      sql.includes('UPDATE customer_refresh_tokens SET revoked_at = NOW()') &&
      sql.includes('WHERE customer_id = $1 AND revoked_at IS NULL')

    it('allows only one of two parallel refreshes with the same RT', async () => {
      let claimCount = 0
      mockPoolQuery.mockImplementation(async (sql: string) => {
        if (isAtomicClaim(sql)) {
          claimCount += 1
          if (claimCount === 1) {
            return { rows: [{ id: 100, customer_id: 11 }] }
          }
          return { rows: [] }
        }
        if (isReuseLookup(sql)) {
          return {
            rows: [
              {
                id: 100,
                customer_id: 11,
                revoked_at: new Date(),
                expires_at: new Date(Date.now() + 60_000),
              },
            ],
          }
        }
        if (isMassRevoke(sql)) return { rows: [], rowCount: 1 }
        if (sql.includes('FROM customers') && sql.includes('WHERE id = $1')) {
          return { rows: [customerRow] }
        }
        if (sql.includes('INSERT INTO customer_refresh_tokens')) {
          return { rows: [] }
        }
        return { rows: [] }
      })

      const raw = 'same-refresh-token-raw'
      const [a, b] = await Promise.allSettled([
        refreshCustomerSession(raw),
        refreshCustomerSession(raw),
      ])

      const successes = [a, b].filter((r) => r.status === 'fulfilled')
      const failures = [a, b].filter((r) => r.status === 'rejected')
      expect(successes).toHaveLength(1)
      expect(failures).toHaveLength(1)
      expect((failures[0] as PromiseRejectedResult).reason).toMatchObject({
        status: 401,
        message: 'Invalid refresh token',
      })
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE customer_id = $1 AND revoked_at IS NULL'),
        [11],
      )
    })

    it('on reuse of revoked RT mass-revokes all sessions for the customer', async () => {
      let claimCount = 0
      mockPoolQuery.mockImplementation(async (sql: string) => {
        if (isAtomicClaim(sql)) {
          claimCount += 1
          if (claimCount === 1) {
            return { rows: [{ id: 100, customer_id: 11 }] }
          }
          return { rows: [] }
        }
        if (isReuseLookup(sql)) {
          return {
            rows: [
              {
                id: 100,
                customer_id: 11,
                revoked_at: new Date(),
                expires_at: new Date(Date.now() + 60_000),
              },
            ],
          }
        }
        if (isMassRevoke(sql)) return { rows: [], rowCount: 2 }
        if (sql.includes('FROM customers') && sql.includes('WHERE id = $1')) {
          return { rows: [customerRow] }
        }
        if (sql.includes('INSERT INTO customer_refresh_tokens')) {
          return { rows: [] }
        }
        return { rows: [] }
      })

      const raw = 'reuse-refresh-token'
      await expect(refreshCustomerSession(raw)).resolves.toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      })

      await expect(refreshCustomerSession(raw)).rejects.toMatchObject({ status: 401 })
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringMatching(
          /UPDATE customer_refresh_tokens SET revoked_at = NOW\(\)[\s\S]*WHERE customer_id = \$1 AND revoked_at IS NULL/,
        ),
        [11],
      )
    })
  })
})
