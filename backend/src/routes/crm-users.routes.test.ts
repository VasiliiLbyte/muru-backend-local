import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyAdminJwt = vi.fn()
const mockListCrmUsers = vi.fn()
const mockCreateCrmUser = vi.fn()
const mockPatchCrmUser = vi.fn()
const mockResetCrmUserPassword = vi.fn()
const mockDeleteCrmUser = vi.fn()

vi.mock('../services/admin-auth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/admin-auth.service')>()
  return {
    ...actual,
    verifyAdminJwt: (...args: unknown[]) => mockVerifyAdminJwt(...args),
  }
})

vi.mock('../services/crm-users.service', () => ({
  listCrmUsers: (...args: unknown[]) => mockListCrmUsers(...args),
  createCrmUser: (...args: unknown[]) => mockCreateCrmUser(...args),
  patchCrmUser: (...args: unknown[]) => mockPatchCrmUser(...args),
  resetCrmUserPassword: (...args: unknown[]) => mockResetCrmUserPassword(...args),
  deleteCrmUser: (...args: unknown[]) => mockDeleteCrmUser(...args),
}))

import { errorHandler } from '../middleware/error-handler.middleware'
import { crmUsersRouter } from '../routes/crm-users.routes'

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/crm/users', crmUsersRouter)
  app.use(errorHandler)
  return app
}

const sampleUser = {
  id: 2,
  email: 'manager@example.com',
  role: 'manager' as const,
  is_active: true,
  created_at: '2026-01-02T00:00:00.000Z',
  last_login_at: null,
}

describe('crm-users.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
  })

  it('returns 401 without cookie', async () => {
    const res = await request(buildApp()).get('/api/crm/users')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('manager cookie → any /api/crm/users* → 403', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 2, role: 'manager' })
    const app = buildApp()

    const list = await request(app).get('/api/crm/users').set('Cookie', 'admin_token=valid')
    expect(list.status).toBe(403)

    const create = await request(app)
      .post('/api/crm/users')
      .set('Cookie', 'admin_token=valid')
      .send({ email: 'a@b.com', password: 'password12345', role: 'manager' })
    expect(create.status).toBe(403)

    const patch = await request(app)
      .patch('/api/crm/users/2')
      .set('Cookie', 'admin_token=valid')
      .send({ role: 'owner' })
    expect(patch.status).toBe(403)

    const password = await request(app)
      .post('/api/crm/users/2/password')
      .set('Cookie', 'admin_token=valid')
      .send({ password: 'password12345' })
    expect(password.status).toBe(403)

    const del = await request(app).delete('/api/crm/users/2').set('Cookie', 'admin_token=valid')
    expect(del.status).toBe(403)

    expect(mockListCrmUsers).not.toHaveBeenCalled()
    expect(mockCreateCrmUser).not.toHaveBeenCalled()
  })

  it('owner list → 200', async () => {
    mockListCrmUsers.mockResolvedValueOnce([sampleUser])
    const res = await request(buildApp()).get('/api/crm/users').set('Cookie', 'admin_token=valid')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual([sampleUser])
  })

  it('owner create → 201', async () => {
    mockCreateCrmUser.mockResolvedValueOnce(sampleUser)
    const res = await request(buildApp())
      .post('/api/crm/users')
      .set('Cookie', 'admin_token=valid')
      .send({ email: 'manager@example.com', password: 'password12345', role: 'manager' })
    expect(res.status).toBe(201)
    expect(res.body.data).toEqual(sampleUser)
    expect(mockCreateCrmUser).toHaveBeenCalledWith({
      email: 'manager@example.com',
      password: 'password12345',
      role: 'manager',
    })
  })

  it('owner create with short password → 422', async () => {
    const res = await request(buildApp())
      .post('/api/crm/users')
      .set('Cookie', 'admin_token=valid')
      .send({ email: 'manager@example.com', password: 'short', role: 'manager' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(mockCreateCrmUser).not.toHaveBeenCalled()
  })

  it('owner patch → 200', async () => {
    mockPatchCrmUser.mockResolvedValueOnce({ ...sampleUser, role: 'owner' })
    const res = await request(buildApp())
      .patch('/api/crm/users/2')
      .set('Cookie', 'admin_token=valid')
      .send({ role: 'owner' })
    expect(res.status).toBe(200)
    expect(mockPatchCrmUser).toHaveBeenCalledWith(2, { role: 'owner' }, 1)
  })

  it('owner reset password → 200', async () => {
    mockResetCrmUserPassword.mockResolvedValueOnce(undefined)
    const res = await request(buildApp())
      .post('/api/crm/users/2/password')
      .set('Cookie', 'admin_token=valid')
      .send({ password: 'password12345' })
    expect(res.status).toBe(200)
    expect(mockResetCrmUserPassword).toHaveBeenCalledWith(2, 'password12345')
  })

  it('owner delete → 204', async () => {
    mockDeleteCrmUser.mockResolvedValueOnce(undefined)
    const res = await request(buildApp())
      .delete('/api/crm/users/2')
      .set('Cookie', 'admin_token=valid')
    expect(res.status).toBe(204)
    expect(mockDeleteCrmUser).toHaveBeenCalledWith(2, 1)
  })
})
