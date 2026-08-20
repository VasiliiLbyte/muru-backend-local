import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()
const mockSendFlashCall = vi.fn()
const mockVerifySmartCaptcha = vi.fn()
const mockIssueCustomerSession = vi.fn()
const mockFindCustomerByPhone = vi.fn()
const mockLinkGuestOrdersByPhone = vi.fn()

vi.mock('../utils/db', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}))

vi.mock('../utils/env', () => ({
  env: {
    customerAccountsEnabled: true,
    customerJwtSecret: 'secret',
    flashcallConfigured: true,
    customerConsentVersion: '2026-06-03',
  },
}))

vi.mock('./flashcall/streamtelecom.service', () => ({
  sendFlashCall: (...args: unknown[]) => mockSendFlashCall(...args),
  StreamTelecomError: class StreamTelecomError extends Error {
    providerMessage: string
    constructor(message: string) {
      super(message)
      this.providerMessage = message
    }
  },
}))

vi.mock('./smartcaptcha.service', () => ({
  verifySmartCaptcha: (...args: unknown[]) => mockVerifySmartCaptcha(...args),
}))

vi.mock('./customer-auth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./customer-auth.service')>()
  return {
    ...actual,
    issueCustomerSession: (...args: unknown[]) => mockIssueCustomerSession(...args),
    findCustomerByPhone: (...args: unknown[]) => mockFindCustomerByPhone(...args),
    linkGuestOrdersByPhone: (...args: unknown[]) => mockLinkGuestOrdersByPhone(...args),
  }
})

import {
  _resetPhoneOtpCountersForTests,
  OTP_REQUEST_LIMIT_PER_HOUR,
  requestPhoneOtp,
  requiresCaptchaForOtpRequest,
  verifyPhoneOtp,
} from './phone-otp.service'
import { hashToken } from './customer-auth.service'

describe('phone-otp.service', () => {
  const phone = '+79219449115'

  beforeEach(() => {
    vi.clearAllMocks()
    _resetPhoneOtpCountersForTests()
    mockSendFlashCall.mockResolvedValue({ code: '1234' })
    mockVerifySmartCaptcha.mockResolvedValue(undefined)
    mockLinkGuestOrdersByPhone.mockResolvedValue(0)
  })

  it('requestPhoneOtp sends flash call and stores hash', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // cooldown check
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // insert

    const result = await requestPhoneOtp(phone, '127.0.0.1')

    expect(result).toEqual({ ok: true, resendAfterSec: 60, captchaRequired: false })
    expect(mockSendFlashCall).toHaveBeenCalledTimes(1)
    expect(mockQuery).toHaveBeenCalledTimes(2)
    const insertSql = String(mockQuery.mock.calls[1][0])
    expect(insertSql).toContain('INSERT INTO customer_otp_codes')
  })

  it('requestPhoneOtp returns resendAfterSec during cooldown without sending', async () => {
    const createdAt = new Date(Date.now() - 30_000).toISOString()
    mockQuery.mockResolvedValueOnce({ rows: [{ created_at: createdAt }] })

    const result = await requestPhoneOtp(phone, '127.0.0.1')

    expect(result.ok).toBe(true)
    expect(result.resendAfterSec).toBeGreaterThan(0)
    expect(result.resendAfterSec).toBeLessThanOrEqual(30)
    expect(mockSendFlashCall).not.toHaveBeenCalled()
  })

  it('requestPhoneOtp anti-enumeration on rate limit exceeded', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    for (let i = 0; i < OTP_REQUEST_LIMIT_PER_HOUR; i += 1) {
      await requestPhoneOtp(phone, '127.0.0.1')
    }
    mockSendFlashCall.mockClear()
    mockQuery.mockClear()
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await requestPhoneOtp(phone, '127.0.0.1')

    expect(result.ok).toBe(true)
    expect(mockSendFlashCall).not.toHaveBeenCalled()
  })

  it('requestPhoneOtp rejects invalid phone with 400', async () => {
    await expect(requestPhoneOtp('bad', '127.0.0.1')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('requiresCaptchaForOtpRequest after threshold hits', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    for (let i = 0; i < 3; i += 1) {
      await requestPhoneOtp(phone, '10.0.0.1')
    }
    expect(requiresCaptchaForOtpRequest(phone, '10.0.0.1')).toBe(true)
  })

  it('verifyPhoneOtp issues session for existing customer', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            phone,
            code_hash: hashToken('1234'),
            attempts: 0,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            consumed_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // consume
      .mockResolvedValueOnce({ rows: [] }) // update existing
    mockFindCustomerByPhone.mockResolvedValueOnce({
      id: 42,
      phone,
      phoneVerifiedAt: null,
      isActive: true,
    })
    mockIssueCustomerSession.mockResolvedValueOnce({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
      customer: { id: 42, phone, email: null },
    })

    const result = await verifyPhoneOtp(phone, '1234', '127.0.0.1')

    expect(result.accessToken).toBe('a')
    expect(mockLinkGuestOrdersByPhone).toHaveBeenCalledWith(42, phone)
    expect(mockIssueCustomerSession).toHaveBeenCalledWith(42)
  })

  it('verifyPhoneOtp creates phone-only customer when missing', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 8,
            phone,
            code_hash: hashToken('5678'),
            attempts: 0,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            consumed_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // consume
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // insert customer
    mockFindCustomerByPhone.mockResolvedValueOnce(null)
    mockIssueCustomerSession.mockResolvedValueOnce({
      accessToken: 'a2',
      refreshToken: 'r2',
      expiresIn: 900,
      customer: { id: 99, phone, email: null },
    })

    const result = await verifyPhoneOtp(phone, '5678', '127.0.0.1')

    expect(result.customer.id).toBe(99)
    const insertSql = String(mockQuery.mock.calls[2][0])
    expect(insertSql).toContain('INSERT INTO customers')
    expect(insertSql).toContain('last_name')
    expect(insertSql).toContain('first_name')
    expect(insertSql).toContain('middle_name')
  })

  it('verifyPhoneOtp increments attempts on wrong code', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            phone,
            code_hash: hashToken('1234'),
            attempts: 0,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            consumed_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    await expect(verifyPhoneOtp(phone, '9999', '127.0.0.1')).rejects.toMatchObject({
      status: 400,
    })
    expect(mockQuery.mock.calls[1][0]).toContain('SET attempts')
  })

  it('verifyPhoneOtp locks after max attempts', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            phone,
            code_hash: hashToken('1234'),
            attempts: 4,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            consumed_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    await expect(verifyPhoneOtp(phone, '9999', '127.0.0.1')).rejects.toMatchObject({
      status: 429,
    })
  })

  it('verifyPhoneOtp rejects expired or missing code', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await expect(verifyPhoneOtp(phone, '1234', '127.0.0.1')).rejects.toMatchObject({
      status: 400,
    })
  })
})
