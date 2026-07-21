import bcrypt from 'bcryptjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPoolQuery = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
  },
}))

import {
  createCrmUser,
  deleteCrmUser,
  listCrmUsers,
  patchCrmUser,
  resetCrmUserPassword,
} from './crm-users.service'

const ownerRow = {
  id: 1,
  email: 'owner@example.com',
  role: 'owner' as const,
  is_active: true,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  last_login_at: null,
}

const managerRow = {
  id: 2,
  email: 'manager@example.com',
  role: 'manager' as const,
  is_active: true,
  created_at: new Date('2026-01-02T00:00:00.000Z'),
  last_login_at: null,
}

describe('crm-users.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('listCrmUsers returns DTOs without password_hash', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [ownerRow, managerRow] })
    const users = await listCrmUsers()
    expect(users).toEqual([
      {
        id: 1,
        email: 'owner@example.com',
        role: 'owner',
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        last_login_at: null,
      },
      {
        id: 2,
        email: 'manager@example.com',
        role: 'manager',
        is_active: true,
        created_at: '2026-01-02T00:00:00.000Z',
        last_login_at: null,
      },
    ])
    expect(users[0]).not.toHaveProperty('password_hash')
  })

  it('createCrmUser inserts normalized email and hashes password', async () => {
    const hashSpy = vi.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_pw' as never)
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ ...managerRow, email: 'new@example.com', id: 3 }],
    })

    const created = await createCrmUser({
      email: '  New@Example.com ',
      password: 'password12345',
      role: 'manager',
    })

    expect(hashSpy).toHaveBeenCalledWith('password12345', 12)
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_users'),
      ['new@example.com', 'hashed_pw', 'manager'],
    )
    expect(created.email).toBe('new@example.com')
    hashSpy.mockRestore()
  })

  it('createCrmUser rejects short password with 422', async () => {
    await expect(
      createCrmUser({ email: 'a@b.com', password: 'short', role: 'manager' }),
    ).rejects.toMatchObject({ status: 422, code: 'VALIDATION' })
    expect(mockPoolQuery).not.toHaveBeenCalled()
  })

  it('createCrmUser maps unique violation to 409', async () => {
    const hashSpy = vi.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_pw' as never)
    mockPoolQuery.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }))

    await expect(
      createCrmUser({ email: 'dup@example.com', password: 'password12345', role: 'manager' }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT', message: 'Email already exists' })
    hashSpy.mockRestore()
  })

  it('patchCrmUser demote of last active owner → 409', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [ownerRow] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })

    await expect(patchCrmUser(1, { role: 'manager' }, 99)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Cannot demote the last active owner',
    })
  })

  it('patchCrmUser deactivate of last active owner → 409', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [ownerRow] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })

    await expect(patchCrmUser(1, { is_active: false }, 99)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Cannot deactivate the last active owner',
    })
  })

  it('patchCrmUser self demote → 409', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [ownerRow] })

    await expect(patchCrmUser(1, { role: 'manager' }, 1)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Cannot demote yourself',
    })
  })

  it('patchCrmUser self deactivate → 409', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [ownerRow] })

    await expect(patchCrmUser(1, { is_active: false }, 1)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Cannot deactivate yourself',
    })
  })

  it('patchCrmUser happy path updates role and is_active', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [managerRow] })
      .mockResolvedValueOnce({
        rows: [{ ...managerRow, role: 'owner', is_active: false }],
      })

    const updated = await patchCrmUser(2, { role: 'owner', is_active: false }, 1)
    expect(updated.role).toBe('owner')
    expect(updated.is_active).toBe(false)
    expect(mockPoolQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE admin_users'),
      [2, 'owner', false],
    )
  })

  it('resetCrmUserPassword updates hash; new password matches, old does not', async () => {
    const oldHash = await bcrypt.hash('old-password-12', 4)
    const newPassword = 'new-password-12'
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [managerRow] })
      .mockResolvedValueOnce({ rows: [] })

    await resetCrmUserPassword(2, newPassword)

    const [, params] = mockPoolQuery.mock.calls[1] as [string, [number, string]]
    const storedHash = params[1]
    expect(await bcrypt.compare(newPassword, storedHash)).toBe(true)
    expect(await bcrypt.compare('old-password-12', storedHash)).toBe(false)
    expect(await bcrypt.compare('old-password-12', oldHash)).toBe(true)
  })

  it('resetCrmUserPassword rejects short password with 422', async () => {
    await expect(resetCrmUserPassword(2, 'short')).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION',
    })
    expect(mockPoolQuery).not.toHaveBeenCalled()
  })

  it('deleteCrmUser of last active owner → 409', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [ownerRow] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })

    await expect(deleteCrmUser(1, 99)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Cannot delete the last active owner',
    })
  })

  it('deleteCrmUser self → 409', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [ownerRow] })

    await expect(deleteCrmUser(1, 1)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Cannot delete yourself',
    })
  })

  it('deleteCrmUser happy path deletes manager', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [managerRow] }).mockResolvedValueOnce({ rows: [] })

    await deleteCrmUser(2, 1)
    expect(mockPoolQuery).toHaveBeenNthCalledWith(2, expect.stringContaining('DELETE FROM admin_users'), [
      2,
    ])
  })
})
