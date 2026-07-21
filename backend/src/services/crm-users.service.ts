import {
  type AdminRole,
  hashAdminPassword,
  normalizeEmail,
  PASSWORD_MIN_LENGTH,
} from './admin-auth.service'
import { HttpError } from '../utils/api-response'
import { pool } from '../utils/db'

export type CrmUserDto = {
  id: number
  email: string
  role: AdminRole
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

type CrmUserDbRow = {
  id: number
  email: string
  role: AdminRole
  is_active: boolean
  created_at: Date | string
  last_login_at: Date | string | null
}

export type CreateCrmUserInput = {
  email: string
  password: string
  role: AdminRole
}

export type PatchCrmUserInput = {
  role?: AdminRole
  is_active?: boolean
}

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505'

const toIso = (value: Date | string | null): string | null => {
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

const toDto = (row: CrmUserDbRow): CrmUserDto => ({
  id: row.id,
  email: row.email,
  role: row.role,
  is_active: row.is_active,
  created_at: toIso(row.created_at) ?? String(row.created_at),
  last_login_at: toIso(row.last_login_at),
})

const assertPasswordLength = (password: string): void => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new HttpError(
      422,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      'VALIDATION',
    )
  }
}

const countActiveOwners = async (): Promise<number> => {
  const result = await pool.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count
     FROM admin_users
     WHERE role = 'owner' AND is_active = true`,
  )
  return Number(result.rows[0]?.count ?? 0)
}

const findCrmUserRowById = async (id: number): Promise<CrmUserDbRow | null> => {
  const result = await pool.query<CrmUserDbRow>(
    `SELECT id, email, role, is_active, created_at, last_login_at
     FROM admin_users
     WHERE id = $1
     LIMIT 1`,
    [id],
  )
  return result.rows[0] ?? null
}

const assertNotSelfDestructive = (
  actorId: number,
  target: CrmUserDbRow,
  action: 'demote' | 'deactivate' | 'delete',
): void => {
  if (actorId !== target.id) return
  const messages = {
    demote: 'Cannot demote yourself',
    deactivate: 'Cannot deactivate yourself',
    delete: 'Cannot delete yourself',
  } as const
  throw new HttpError(409, messages[action], 'CONFLICT')
}

const assertNotLastActiveOwner = async (
  target: CrmUserDbRow,
  action: 'demote' | 'deactivate' | 'delete',
): Promise<void> => {
  if (target.role !== 'owner' || !target.is_active) return
  const activeOwners = await countActiveOwners()
  if (activeOwners !== 1) return
  const messages = {
    demote: 'Cannot demote the last active owner',
    deactivate: 'Cannot deactivate the last active owner',
    delete: 'Cannot delete the last active owner',
  } as const
  throw new HttpError(409, messages[action], 'CONFLICT')
}

export const listCrmUsers = async (): Promise<CrmUserDto[]> => {
  const result = await pool.query<CrmUserDbRow>(
    `SELECT id, email, role, is_active, created_at, last_login_at
     FROM admin_users
     ORDER BY id ASC`,
  )
  return result.rows.map(toDto)
}

export const createCrmUser = async (input: CreateCrmUserInput): Promise<CrmUserDto> => {
  assertPasswordLength(input.password)
  const email = normalizeEmail(input.email)
  const passwordHash = await hashAdminPassword(input.password)

  try {
    const result = await pool.query<CrmUserDbRow>(
      `INSERT INTO admin_users (email, password_hash, role, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, email, role, is_active, created_at, last_login_at`,
      [email, passwordHash, input.role],
    )
    const row = result.rows[0]
    if (!row) {
      throw new HttpError(500, 'Failed to create user', 'INTERNAL')
    }
    return toDto(row)
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'Email already exists', 'CONFLICT')
    }
    throw err
  }
}

export const patchCrmUser = async (
  id: number,
  input: PatchCrmUserInput,
  actorId: number,
): Promise<CrmUserDto> => {
  const target = await findCrmUserRowById(id)
  if (!target) {
    throw new HttpError(404, 'User not found', 'NOT_FOUND')
  }

  const nextRole = input.role ?? target.role
  const nextActive = input.is_active ?? target.is_active
  const isDemote = target.role === 'owner' && nextRole === 'manager'
  const isDeactivate = target.is_active && !nextActive

  if (isDemote) {
    assertNotSelfDestructive(actorId, target, 'demote')
    await assertNotLastActiveOwner(target, 'demote')
  }
  if (isDeactivate) {
    assertNotSelfDestructive(actorId, target, 'deactivate')
    await assertNotLastActiveOwner(target, 'deactivate')
  }

  const result = await pool.query<CrmUserDbRow>(
    `UPDATE admin_users
     SET role = $2, is_active = $3
     WHERE id = $1
     RETURNING id, email, role, is_active, created_at, last_login_at`,
    [id, nextRole, nextActive],
  )
  const row = result.rows[0]
  if (!row) {
    throw new HttpError(404, 'User not found', 'NOT_FOUND')
  }
  return toDto(row)
}

export const resetCrmUserPassword = async (id: number, password: string): Promise<void> => {
  assertPasswordLength(password)
  const target = await findCrmUserRowById(id)
  if (!target) {
    throw new HttpError(404, 'User not found', 'NOT_FOUND')
  }
  const passwordHash = await hashAdminPassword(password)
  await pool.query(`UPDATE admin_users SET password_hash = $2 WHERE id = $1`, [id, passwordHash])
}

export const deleteCrmUser = async (id: number, actorId: number): Promise<void> => {
  const target = await findCrmUserRowById(id)
  if (!target) {
    throw new HttpError(404, 'User not found', 'NOT_FOUND')
  }
  assertNotSelfDestructive(actorId, target, 'delete')
  await assertNotLastActiveOwner(target, 'delete')
  await pool.query(`DELETE FROM admin_users WHERE id = $1`, [id])
}
