import { createHash, randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import { normalizeRussianPhone } from './cdek/phone'
import {
  EmailNotConfiguredError,
  EmailSendError,
  sendPasswordResetEmail,
  sendVerifyEmail,
} from './email.service'
import { pool } from '../utils/db'
import { env } from '../utils/env'
import { normalizeEmail } from '../utils/normalize-email'
import { DUMMY_HASH } from './admin-auth.service'

export { normalizeEmail }

export const CUSTOMER_PASSWORD_MIN_LENGTH = 8
export const BCRYPT_COST = 12
export const ACCESS_TTL = '15m'
export const REFRESH_TTL_MS = 180 * 24 * 60 * 60 * 1000
export const AUTH_TOKEN_TTL_MS = 60 * 60 * 1000
export const LOGIN_FAIL_CAPTCHA_THRESHOLD = 3

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password'

export type CustomerJwtPayload = {
  customerId: number
}

export type CustomerDto = {
  id: number
  email: string
  fullName: string
  phone: string | null
  emailVerified: boolean
  phoneVerified: boolean
  isActive: boolean
  consentAccepted: boolean
  consentVersion: string | null
  createdAt: string
  lastLoginAt: string | null
}

type CustomerDbRow = {
  id: number
  email: string
  password_hash: string
  full_name: string
  phone: string | null
  phone_verified_at: Date | string | null
  email_verified_at: Date | string | null
  telegram_id: string | number | null
  is_active: boolean
  consent_accepted: boolean
  consent_version: string | null
  consent_accepted_at: Date | string | null
  created_at: Date | string
  last_login_at: Date | string | null
}

export type CustomerRow = {
  id: number
  email: string
  passwordHash: string
  fullName: string
  phone: string | null
  phoneVerifiedAt: string | null
  emailVerifiedAt: string | null
  telegramId: number | null
  isActive: boolean
  consentAccepted: boolean
  consentVersion: string | null
  createdAt: string
  lastLoginAt: string | null
}

export type TokenPair = {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

const loginFailCounts = new Map<string, { count: number; resetAt: number }>()

const toIso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
}

const toCustomerRow = (row: CustomerDbRow): CustomerRow => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  fullName: row.full_name,
  phone: row.phone,
  phoneVerifiedAt: toIso(row.phone_verified_at),
  emailVerifiedAt: toIso(row.email_verified_at),
  telegramId: row.telegram_id == null ? null : Number(row.telegram_id),
  isActive: row.is_active,
  consentAccepted: row.consent_accepted,
  consentVersion: row.consent_version,
  createdAt: toIso(row.created_at) ?? String(row.created_at),
  lastLoginAt: toIso(row.last_login_at),
})

export const toCustomerDto = (row: CustomerRow | CustomerDbRow): CustomerDto => {
  const normalized = 'passwordHash' in row ? row : toCustomerRow(row)
  return {
    id: normalized.id,
    email: normalized.email,
    fullName: normalized.fullName,
    phone: normalized.phone,
    emailVerified: Boolean(normalized.emailVerifiedAt),
    phoneVerified: Boolean(normalized.phoneVerifiedAt),
    isActive: normalized.isActive,
    consentAccepted: normalized.consentAccepted,
    consentVersion: normalized.consentVersion,
    createdAt: normalized.createdAt,
    lastLoginAt: normalized.lastLoginAt,
  }
}

export const hashCustomerPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_COST)

export const hashToken = (raw: string): string =>
  createHash('sha256').update(raw).digest('hex')

export const generateRawToken = (): string => randomBytes(32).toString('hex')

export const assertCustomerModuleEnabled = (): void => {
  if (!env.customerAccountsEnabled || !env.customerJwtSecret) {
    const err = new Error('Customer account module is not configured') as Error & {
      status?: number
      code?: string
    }
    err.status = 503
    err.code = 'UPSTREAM'
    throw err
  }
}

export const signCustomerAccessJwt = (payload: CustomerJwtPayload): string => {
  assertCustomerModuleEnabled()
  return jwt.sign(payload, env.customerJwtSecret, { expiresIn: ACCESS_TTL })
}

export const verifyCustomerAccessJwt = (token: string): CustomerJwtPayload | null => {
  if (!env.customerJwtSecret) return null
  try {
    const decoded = jwt.verify(token, env.customerJwtSecret) as Partial<CustomerJwtPayload>
    if (typeof decoded.customerId !== 'number' || !Number.isInteger(decoded.customerId)) {
      return null
    }
    return { customerId: decoded.customerId }
  } catch {
    return null
  }
}

export const loginFailKey = (ip: string, email: string): string =>
  `ip:${ip}|email:${normalizeEmail(email)}`

export const getLoginFailCount = (ip: string, email: string): number => {
  const key = loginFailKey(ip, email)
  const entry = loginFailCounts.get(key)
  if (!entry) return 0
  if (entry.resetAt <= Date.now()) {
    loginFailCounts.delete(key)
    return 0
  }
  return entry.count
}

export const recordLoginFailure = (ip: string, email: string): number => {
  const key = loginFailKey(ip, email)
  const now = Date.now()
  const entry = loginFailCounts.get(key)
  if (!entry || entry.resetAt <= now) {
    loginFailCounts.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return 1
  }
  entry.count += 1
  return entry.count
}

export const clearLoginFailures = (ip: string, email: string): void => {
  loginFailCounts.delete(loginFailKey(ip, email))
}

/** Test helper */
export const _resetLoginFailCountsForTests = (): void => {
  loginFailCounts.clear()
}

export const requiresCaptchaForLogin = (ip: string, email: string): boolean =>
  getLoginFailCount(ip, email) >= LOGIN_FAIL_CAPTCHA_THRESHOLD

export const parseOptionalPhone = (raw: string | null | undefined): string | null => {
  if (raw == null || String(raw).trim() === '') return null
  const normalized = normalizeRussianPhone(raw)
  if (!normalized) {
    const err = new Error('Invalid phone number') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }
  return normalized
}

export const parseRequiredPhone = (raw: string | null | undefined): string => {
  const phone = parseOptionalPhone(raw)
  if (!phone) {
    const err = new Error('Phone is required') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }
  return phone
}

const CUSTOMER_SELECT = `id, email, password_hash, full_name, phone, phone_verified_at,
  email_verified_at, telegram_id, is_active, consent_accepted, consent_version,
  consent_accepted_at, created_at, last_login_at`

export const findCustomerByEmail = async (email: string): Promise<CustomerRow | null> => {
  const result = await pool.query<CustomerDbRow>(
    `SELECT ${CUSTOMER_SELECT} FROM customers WHERE email = $1 LIMIT 1`,
    [normalizeEmail(email)],
  )
  const row = result.rows[0]
  return row ? toCustomerRow(row) : null
}

export const findCustomerById = async (id: number): Promise<CustomerRow | null> => {
  const result = await pool.query<CustomerDbRow>(
    `SELECT ${CUSTOMER_SELECT} FROM customers WHERE id = $1 LIMIT 1`,
    [id],
  )
  const row = result.rows[0]
  return row ? toCustomerRow(row) : null
}

const issueRefreshToken = async (customerId: number): Promise<string> => {
  const raw = generateRawToken()
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)
  await pool.query(
    `INSERT INTO customer_refresh_tokens (customer_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [customerId, tokenHash, expiresAt.toISOString()],
  )
  return raw
}

const issueTokenPair = async (customerId: number): Promise<TokenPair> => {
  const accessToken = signCustomerAccessJwt({ customerId })
  const refreshToken = await issueRefreshToken(customerId)
  return { accessToken, refreshToken, expiresIn: 15 * 60 }
}

const createAuthToken = async (
  customerId: number,
  kind: 'email_verify' | 'password_reset',
): Promise<string> => {
  const raw = generateRawToken()
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + AUTH_TOKEN_TTL_MS)
  await pool.query(
    `INSERT INTO customer_auth_tokens (customer_id, kind, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [customerId, kind, tokenHash, expiresAt.toISOString()],
  )
  return raw
}

export type RegisterInput = {
  email: string
  password: string
  fullName: string
  phone?: string | null
  consentAccepted: boolean
}

export const registerCustomer = async (
  input: RegisterInput,
): Promise<{ customer: CustomerDto }> => {
  assertCustomerModuleEnabled()

  if (!input.consentAccepted) {
    const err = new Error('Consent is required') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }
  if (input.password.length < CUSTOMER_PASSWORD_MIN_LENGTH) {
    const err = new Error(`Password must be at least ${CUSTOMER_PASSWORD_MIN_LENGTH} characters`) as Error & {
      status?: number
      code?: string
    }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }

  const email = normalizeEmail(input.email)
  const phone = parseOptionalPhone(input.phone)
  const existing = await findCustomerByEmail(email)
  if (existing) {
    const err = new Error('Email is already registered') as Error & { status?: number; code?: string }
    err.status = 409
    err.code = 'CONFLICT'
    throw err
  }

  const passwordHash = await hashCustomerPassword(input.password)
  const consentVersion = env.customerConsentVersion
  const insert = await pool.query<CustomerDbRow>(
    `INSERT INTO customers (
       email, password_hash, full_name, phone,
       consent_accepted, consent_version, consent_accepted_at
     ) VALUES ($1, $2, $3, $4, true, $5, NOW())
     RETURNING ${CUSTOMER_SELECT}`,
    [email, passwordHash, input.fullName.trim(), phone, consentVersion],
  )
  const customer = toCustomerRow(insert.rows[0]!)
  const verifyToken = await createAuthToken(customer.id, 'email_verify')
  try {
    await sendVerifyEmail(email, verifyToken)
  } catch (error) {
    await pool.query(`DELETE FROM customers WHERE id = $1`, [customer.id])
    const err = (error instanceof Error ? error : new Error('Failed to send verification email')) as Error & {
      status?: number
      code?: string
    }
    err.status = 503
    err.code = 'UPSTREAM'
    throw err
  }

  return { customer: toCustomerDto(customer) }
}

export const resendVerifyEmail = async (emailRaw: string): Promise<{ ok: true }> => {
  assertCustomerModuleEnabled()
  const email = normalizeEmail(emailRaw)
  const customer = await findCustomerByEmail(email)
  if (customer && customer.isActive && !customer.emailVerifiedAt) {
    const token = await createAuthToken(customer.id, 'email_verify')
    try {
      await sendVerifyEmail(email, token)
    } catch (error) {
      if (error instanceof EmailNotConfiguredError || error instanceof EmailSendError) {
        const err = error as Error & { status?: number; code?: string }
        err.status = 503
        err.code = 'UPSTREAM'
        throw err
      }
      throw error
    }
  }
  return { ok: true }
}

export const verifyEmailToken = async (rawToken: string): Promise<{ ok: true }> => {
  assertCustomerModuleEnabled()
  const tokenHash = hashToken(rawToken)
  const result = await pool.query<{ customer_id: number }>(
    `UPDATE customer_auth_tokens
     SET used_at = NOW()
     WHERE token_hash = $1 AND kind = 'email_verify' AND used_at IS NULL AND expires_at > NOW()
     RETURNING customer_id`,
    [tokenHash],
  )
  const row = result.rows[0]
  if (!row) {
    const err = new Error('Invalid or expired token') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }

  await pool.query(
    `UPDATE customers SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1`,
    [row.customer_id],
  )

  const customer = await findCustomerById(row.customer_id)
  if (customer?.emailVerifiedAt) {
    await linkGuestOrdersToCustomer(customer.id, customer.email)
  }

  return { ok: true }
}

/**
 * Attach guest orders (matching email, no customer_id yet) to a verified customer.
 * No-op if customer is missing or email is not verified.
 */
export const linkGuestOrdersToCustomer = async (
  customerId: number,
  email: string,
): Promise<number> => {
  const customer = await findCustomerById(customerId)
  if (!customer || !customer.isActive || !customer.emailVerifiedAt) {
    return 0
  }

  const normalized = normalizeEmail(email)
  const result = await pool.query(
    `UPDATE orders SET customer_id = $1
     WHERE customer_id IS NULL
       AND lower(trim(customer_email)) = $2`,
    [customerId, normalized],
  )
  return result.rowCount ?? 0
}

export const loginCustomer = async (
  emailRaw: string,
  password: string,
  ip: string,
): Promise<TokenPair & { customer: CustomerDto }> => {
  assertCustomerModuleEnabled()
  const email = normalizeEmail(emailRaw)
  const customer = await findCustomerByEmail(email)

  if (!customer || !customer.isActive) {
    await bcrypt.compare(password, DUMMY_HASH)
    recordLoginFailure(ip, email)
    const err = new Error(INVALID_CREDENTIALS_MESSAGE) as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'UNAUTHORIZED'
    throw err
  }

  const passwordOk = await bcrypt.compare(password, customer.passwordHash)
  if (!passwordOk) {
    recordLoginFailure(ip, email)
    const err = new Error(INVALID_CREDENTIALS_MESSAGE) as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'UNAUTHORIZED'
    throw err
  }

  clearLoginFailures(ip, email)
  await pool.query(`UPDATE customers SET last_login_at = NOW() WHERE id = $1`, [customer.id])
  const tokens = await issueTokenPair(customer.id)
  const fresh = await findCustomerById(customer.id)
  return { ...tokens, customer: toCustomerDto(fresh ?? customer) }
}

export const logoutCustomer = async (refreshTokenRaw: string): Promise<{ ok: true }> => {
  assertCustomerModuleEnabled()
  const tokenHash = hashToken(refreshTokenRaw)
  await pool.query(
    `UPDATE customer_refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  )
  return { ok: true }
}

export const refreshCustomerSession = async (
  refreshTokenRaw: string,
): Promise<TokenPair & { customer: CustomerDto }> => {
  assertCustomerModuleEnabled()
  const tokenHash = hashToken(refreshTokenRaw)
  const result = await pool.query<{
    id: number
    customer_id: number
    expires_at: Date | string
    revoked_at: Date | string | null
  }>(
    `SELECT id, customer_id, expires_at, revoked_at
     FROM customer_refresh_tokens
     WHERE token_hash = $1
     LIMIT 1`,
    [tokenHash],
  )
  const row = result.rows[0]
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
    const err = new Error('Invalid refresh token') as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'UNAUTHORIZED'
    throw err
  }

  await pool.query(`UPDATE customer_refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id])

  const customer = await findCustomerById(row.customer_id)
  if (!customer || !customer.isActive) {
    const err = new Error('Invalid refresh token') as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'UNAUTHORIZED'
    throw err
  }

  const tokens = await issueTokenPair(customer.id)
  return { ...tokens, customer: toCustomerDto(customer) }
}

export const forgotPassword = async (emailRaw: string): Promise<{ ok: true }> => {
  assertCustomerModuleEnabled()
  const email = normalizeEmail(emailRaw)
  const customer = await findCustomerByEmail(email)
  if (customer && customer.isActive) {
    const token = await createAuthToken(customer.id, 'password_reset')
    try {
      await sendPasswordResetEmail(email, token)
    } catch (error) {
      if (error instanceof EmailNotConfiguredError || error instanceof EmailSendError) {
        const err = error as Error & { status?: number; code?: string }
        err.status = 503
        err.code = 'UPSTREAM'
        throw err
      }
      throw error
    }
  }
  return { ok: true }
}

export const resetPassword = async (rawToken: string, newPassword: string): Promise<{ ok: true }> => {
  assertCustomerModuleEnabled()
  if (newPassword.length < CUSTOMER_PASSWORD_MIN_LENGTH) {
    const err = new Error(`Password must be at least ${CUSTOMER_PASSWORD_MIN_LENGTH} characters`) as Error & {
      status?: number
      code?: string
    }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }

  const tokenHash = hashToken(rawToken)
  const claim = await pool.query<{ customer_id: number }>(
    `UPDATE customer_auth_tokens
     SET used_at = NOW()
     WHERE token_hash = $1 AND kind = 'password_reset' AND used_at IS NULL AND expires_at > NOW()
     RETURNING customer_id`,
    [tokenHash],
  )
  const row = claim.rows[0]
  if (!row) {
    const err = new Error('Invalid or expired token') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }

  const passwordHash = await hashCustomerPassword(newPassword)
  await pool.query(`UPDATE customers SET password_hash = $1 WHERE id = $2`, [
    passwordHash,
    row.customer_id,
  ])
  await pool.query(
    `UPDATE customer_refresh_tokens SET revoked_at = NOW()
     WHERE customer_id = $1 AND revoked_at IS NULL`,
    [row.customer_id],
  )
  return { ok: true }
}

export const changePassword = async (
  customerId: number,
  oldPassword: string,
  newPassword: string,
): Promise<{ ok: true }> => {
  assertCustomerModuleEnabled()
  if (newPassword.length < CUSTOMER_PASSWORD_MIN_LENGTH) {
    const err = new Error(`Password must be at least ${CUSTOMER_PASSWORD_MIN_LENGTH} characters`) as Error & {
      status?: number
      code?: string
    }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }
  const customer = await findCustomerById(customerId)
  if (!customer || !customer.isActive) {
    const err = new Error('Unauthorized') as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'UNAUTHORIZED'
    throw err
  }
  const okOld = await bcrypt.compare(oldPassword, customer.passwordHash)
  if (!okOld) {
    const err = new Error('Invalid current password') as Error & { status?: number; code?: string }
    err.status = 400
    err.code = 'VALIDATION'
    throw err
  }
  const passwordHash = await hashCustomerPassword(newPassword)
  await pool.query(`UPDATE customers SET password_hash = $1 WHERE id = $2`, [passwordHash, customerId])
  await pool.query(
    `UPDATE customer_refresh_tokens SET revoked_at = NOW()
     WHERE customer_id = $1 AND revoked_at IS NULL`,
    [customerId],
  )
  return { ok: true }
}

export const updateCustomerProfile = async (
  customerId: number,
  input: { fullName: string; phone: string },
): Promise<CustomerDto> => {
  assertCustomerModuleEnabled()
  const phone = parseRequiredPhone(input.phone)
  const result = await pool.query<CustomerDbRow>(
    `UPDATE customers SET full_name = $1, phone = $2
     WHERE id = $3 AND is_active = true
     RETURNING ${CUSTOMER_SELECT}`,
    [input.fullName.trim(), phone, customerId],
  )
  const row = result.rows[0]
  if (!row) {
    const err = new Error('Unauthorized') as Error & { status?: number; code?: string }
    err.status = 401
    err.code = 'UNAUTHORIZED'
    throw err
  }
  return toCustomerDto(row)
}
