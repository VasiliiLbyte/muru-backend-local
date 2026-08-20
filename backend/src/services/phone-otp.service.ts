import { pool } from '../utils/db'
import { env } from '../utils/env'

import {
  assertCustomerModuleEnabled,
  findCustomerByPhone,
  hashToken,
  issueCustomerSession,
  linkGuestOrdersByPhone,
  LOGIN_FAIL_CAPTCHA_THRESHOLD,
  parseOptionalPhone,
  type CustomerDto,
  type TokenPair,
} from './customer-auth.service'
import { sendFlashCall, StreamTelecomError } from './flashcall/streamtelecom.service'
import { verifySmartCaptcha } from './smartcaptcha.service'

export const OTP_TTL_MS = 5 * 60 * 1000
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000
export const OTP_REQUEST_LIMIT_PER_HOUR = 5
export const OTP_REQUEST_WINDOW_MS = 60 * 60 * 1000
export const OTP_VERIFY_ATTEMPT_LIMIT = 5

type OtpCodeRow = {
  id: number
  phone: string
  code_hash: string
  attempts: number
  expires_at: Date | string
  consumed_at: Date | string | null
}

const otpRequestCounts = new Map<string, { count: number; resetAt: number }>()
const otpRequestCaptchaCounts = new Map<string, { count: number; resetAt: number }>()

const bumpWindowCount = (
  map: Map<string, { count: number; resetAt: number }>,
  key: string,
  windowMs: number,
): number => {
  const now = Date.now()
  const entry = map.get(key)
  if (!entry || entry.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs })
    return 1
  }
  entry.count += 1
  return entry.count
}

const getWindowCount = (
  map: Map<string, { count: number; resetAt: number }>,
  key: string,
): number => {
  const entry = map.get(key)
  if (!entry) return 0
  if (entry.resetAt <= Date.now()) {
    map.delete(key)
    return 0
  }
  return entry.count
}

const otpRequestKey = (phone: string): string => phone
const otpCaptchaKey = (phone: string, ip: string): string => `${phone}|${ip}`

export const assertFlashcallEnabled = (): void => {
  assertCustomerModuleEnabled()
  if (!env.flashcallConfigured) {
    const err = new Error('Flash call auth is not configured') as Error & {
      status?: number
      code?: string
    }
    err.status = 503
    err.code = 'UPSTREAM'
    throw err
  }
}

export const requiresCaptchaForOtpRequest = (phone: string, ip: string): boolean =>
  getWindowCount(otpRequestCaptchaCounts, otpCaptchaKey(phone, ip)) >=
  LOGIN_FAIL_CAPTCHA_THRESHOLD

export const _resetPhoneOtpCountersForTests = (): void => {
  otpRequestCounts.clear()
  otpRequestCaptchaCounts.clear()
}

const generateOtpCode = (): number => Math.floor(1000 + Math.random() * 9000)

const getResendAfterSec = async (phone: string): Promise<number> => {
  const result = await pool.query<{ created_at: Date | string }>(
    `SELECT created_at FROM customer_otp_codes
     WHERE phone = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone],
  )
  const row = result.rows[0]
  if (!row) return 0
  const createdAt = new Date(row.created_at).getTime()
  const elapsed = Date.now() - createdAt
  const remaining = OTP_RESEND_COOLDOWN_MS - elapsed
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}

export type OtpRequestResult = {
  ok: true
  resendAfterSec: number
  captchaRequired: boolean
}

export const requestPhoneOtp = async (
  phoneRaw: string,
  ip: string,
  captchaToken?: string,
): Promise<OtpRequestResult> => {
  assertFlashcallEnabled()

  const phone = parseOptionalPhone(phoneRaw)
  if (!phone) {
    const err = new Error('Invalid phone number') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }

  const captchaRequired = requiresCaptchaForOtpRequest(phone, ip)
  bumpWindowCount(otpRequestCaptchaCounts, otpCaptchaKey(phone, ip), OTP_REQUEST_WINDOW_MS)

  if (captchaRequired) {
    await verifySmartCaptcha(captchaToken, ip)
  }

  const resendAfterSec = await getResendAfterSec(phone)
  if (resendAfterSec > 0) {
    return { ok: true, resendAfterSec, captchaRequired }
  }

  if (getWindowCount(otpRequestCounts, otpRequestKey(phone)) >= OTP_REQUEST_LIMIT_PER_HOUR) {
    return { ok: true, resendAfterSec: OTP_RESEND_COOLDOWN_MS / 1000, captchaRequired }
  }

  const code = generateOtpCode()
  try {
    await sendFlashCall({ phone, code })
  } catch (error) {
    console.error('[phone-otp] flash call failed:', error instanceof StreamTelecomError ? error.providerMessage : error)
    return { ok: true, resendAfterSec: OTP_RESEND_COOLDOWN_MS / 1000, captchaRequired }
  }

  const codeHash = hashToken(String(code))
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)
  await pool.query(
    `INSERT INTO customer_otp_codes (phone, code_hash, purpose, request_ip, expires_at)
     VALUES ($1, $2, 'login', $3, $4)`,
    [phone, codeHash, ip, expiresAt.toISOString()],
  )

  bumpWindowCount(otpRequestCounts, otpRequestKey(phone), OTP_REQUEST_WINDOW_MS)

  return { ok: true, resendAfterSec: OTP_RESEND_COOLDOWN_MS / 1000, captchaRequired }
}

const findActiveOtpRow = async (phone: string): Promise<OtpCodeRow | null> => {
  const result = await pool.query<OtpCodeRow>(
    `SELECT id, phone, code_hash, attempts, expires_at, consumed_at
     FROM customer_otp_codes
     WHERE phone = $1
       AND consumed_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone],
  )
  return result.rows[0] ?? null
}

const findOrCreateCustomerByPhone = async (phone: string): Promise<number> => {
  const existing = await findCustomerByPhone(phone)
  if (existing) {
    await pool.query(
      `UPDATE customers
       SET phone_verified_at = COALESCE(phone_verified_at, NOW()),
           last_login_at = NOW()
       WHERE id = $1`,
      [existing.id],
    )
    return existing.id
  }

  const consentVersion = env.customerConsentVersion
  const insert = await pool.query<{ id: number }>(
    `INSERT INTO customers (
       phone, phone_verified_at, consent_accepted, consent_version, consent_accepted_at,
       last_name, first_name, middle_name, full_name, last_login_at
     ) VALUES ($1, NOW(), true, $2, NOW(), '', '', '', '', NOW())
     RETURNING id`,
    [phone, consentVersion],
  )
  return insert.rows[0]!.id
}

export const verifyPhoneOtp = async (
  phoneRaw: string,
  codeRaw: string,
  _ip: string,
): Promise<TokenPair & { customer: CustomerDto }> => {
  assertFlashcallEnabled()

  const phone = parseOptionalPhone(phoneRaw)
  if (!phone) {
    const err = new Error('Invalid phone number') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }

  const code = codeRaw.trim()
  if (!/^\d{4}$/.test(code)) {
    const err = new Error('Invalid verification code') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }

  const row = await findActiveOtpRow(phone)
  if (!row) {
    const err = new Error('Invalid or expired code') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }

  const codeHash = hashToken(code)
  if (codeHash !== row.code_hash) {
    const nextAttempts = row.attempts + 1
    await pool.query(`UPDATE customer_otp_codes SET attempts = $1 WHERE id = $2`, [
      nextAttempts,
      row.id,
    ])
    if (nextAttempts >= OTP_VERIFY_ATTEMPT_LIMIT) {
      const err = new Error('Too many attempts') as Error & { status?: number; code?: string }
      err.status = 429
      err.code = 'RATE_LIMITED'
      throw err
    }
    const err = new Error('Invalid or expired code') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }

  await pool.query(`UPDATE customer_otp_codes SET consumed_at = NOW() WHERE id = $1`, [row.id])

  const customerId = await findOrCreateCustomerByPhone(phone)
  await linkGuestOrdersByPhone(customerId, phone)

  return issueCustomerSession(customerId)
}

/** Test helper: insert OTP row with known code */
export const _insertOtpForTests = async (
  phone: string,
  code: string,
  overrides?: Partial<{ attempts: number; expiresAt: Date; consumedAt: Date | null }>,
): Promise<number> => {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO customer_otp_codes (phone, code_hash, purpose, expires_at, attempts, consumed_at)
     VALUES ($1, $2, 'login', $3, $4, $5)
     RETURNING id`,
    [
      phone,
      hashToken(code),
      (overrides?.expiresAt ?? new Date(Date.now() + OTP_TTL_MS)).toISOString(),
      overrides?.attempts ?? 0,
      overrides?.consumedAt ?? null,
    ],
  )
  return result.rows[0]!.id
}
