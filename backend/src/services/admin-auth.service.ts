import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import { pool } from '../utils/db'
import { env } from '../utils/env'

export type AdminRole = 'owner' | 'manager'

export type AdminJwtPayload = {
  adminId: number
  role: AdminRole
}

type AdminDbRow = {
  id: number
  email: string
  password_hash: string
  role: AdminRole
  is_active: boolean
}

export type AdminRow = {
  id: number
  email: string
  passwordHash: string
  role: AdminRole
  isActive: boolean
}

export type AdminLoginResult = {
  token: string
  email: string
  role: AdminRole
}

export const DUMMY_HASH = '$2b$12$Qf7A0fW4rWuN7qWn1U8l7eM6h4lVY6s2mVw7i7a2M7S2QW6wG0m7u'

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

const toAdminRow = (row: AdminDbRow): AdminRow => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  role: row.role,
  isActive: row.is_active,
})

export const signAdminJwt = (payload: AdminJwtPayload): string => {
  if (!env.adminJwtSecret) {
    throw new Error('ADMIN_JWT_SECRET is not configured')
  }
  return jwt.sign(payload, env.adminJwtSecret, { expiresIn: '12h' })
}

export const verifyAdminJwt = (token: string): AdminJwtPayload | null => {
  if (!env.adminJwtSecret) return null
  try {
    const decoded = jwt.verify(token, env.adminJwtSecret) as Partial<AdminJwtPayload>
    if (
      typeof decoded.adminId !== 'number' ||
      !Number.isInteger(decoded.adminId) ||
      (decoded.role !== 'owner' && decoded.role !== 'manager')
    ) {
      return null
    }
    return { adminId: decoded.adminId, role: decoded.role }
  } catch {
    return null
  }
}

export const findAdminByEmail = async (email: string): Promise<AdminRow | null> => {
  const normalizedEmail = normalizeEmail(email)
  const result = await pool.query<AdminDbRow>(
    `SELECT id, email, password_hash, role, is_active
     FROM admin_users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail],
  )
  const row = result.rows[0]
  return row ? toAdminRow(row) : null
}

export const findAdminById = async (adminId: number): Promise<AdminRow | null> => {
  const result = await pool.query<AdminDbRow>(
    `SELECT id, email, password_hash, role, is_active
     FROM admin_users
     WHERE id = $1
     LIMIT 1`,
    [adminId],
  )
  const row = result.rows[0]
  return row ? toAdminRow(row) : null
}

export const updateLastLogin = async (adminId: number): Promise<void> => {
  await pool.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [adminId])
}

export const login = async (email: string, password: string): Promise<AdminLoginResult | null> => {
  const normalizedEmail = normalizeEmail(email)
  const admin = await findAdminByEmail(normalizedEmail)

  if (!admin || !admin.isActive) {
    await bcrypt.compare(password, DUMMY_HASH)
    return null
  }

  const passwordOk = await bcrypt.compare(password, admin.passwordHash)
  if (!passwordOk) return null

  await updateLastLogin(admin.id)

  return {
    token: signAdminJwt({ adminId: admin.id, role: admin.role }),
    email: admin.email,
    role: admin.role,
  }
}
