import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  isCatalogCrmMode: false,
  adminTelegramIds: [111],
}))

const mockVerifyJwt = vi.fn()
const mockStartCatalogSyncJob = vi.fn()
const mockIsCatalogSyncRunning = vi.fn()
const mockGetSyncSchedule = vi.fn()
const mockUpdateSyncSchedule = vi.fn()

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

vi.mock('../services/jwt.service', () => ({
  verifyJwt: (...args: unknown[]) => mockVerifyJwt(...args),
}))

vi.mock('../services/sync-job-state', () => ({
  getCatalogSyncJobState: () => ({ status: 'idle' }),
  isCatalogSyncRunning: () => mockIsCatalogSyncRunning(),
  startCatalogSyncJob: (...args: unknown[]) => mockStartCatalogSyncJob(...args),
}))

vi.mock('../services/sync-schedule.service', () => ({
  getSyncSchedule: (...args: unknown[]) => mockGetSyncSchedule(...args),
  updateSyncSchedule: (...args: unknown[]) => mockUpdateSyncSchedule(...args),
}))

import { errorHandler } from '../middleware/error-handler.middleware'
import { adminRouter } from './admin'

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/admin', adminRouter)
  app.use(errorHandler)
  return app
}

describe('cutover guards — admin catalog sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.isCatalogCrmMode = false
    mockEnv.adminTelegramIds = [111]
    mockVerifyJwt.mockReturnValue({ userId: 1, telegramId: 111 })
    mockIsCatalogSyncRunning.mockReturnValue(false)
    mockStartCatalogSyncJob.mockReturnValue(true)
    mockGetSyncSchedule.mockResolvedValue({
      enabled: false,
      hourMsk: 4,
      lastAutoRunAt: null,
    })
    mockUpdateSyncSchedule.mockResolvedValue({
      enabled: true,
      hourMsk: 4,
      lastAutoRunAt: null,
    })
  })

  it('POST /api/admin/sync returns 423 when catalog source is crm', async () => {
    mockEnv.isCatalogCrmMode = true

    const res = await request(buildApp())
      .post('/api/admin/sync')
      .set('Authorization', 'Bearer admin-token')
      .set('x-telegram-user-id', '111')
      .send({ telegramUserId: 111 })

    expect(res.status).toBe(423)
    expect(res.body.error.code).toBe('LOCKED')
    expect(mockStartCatalogSyncJob).not.toHaveBeenCalled()
  })

  it('POST /api/admin/sync/stock returns 423 when catalog source is crm', async () => {
    mockEnv.isCatalogCrmMode = true

    const res = await request(buildApp())
      .post('/api/admin/sync/stock')
      .set('Authorization', 'Bearer admin-token')
      .set('x-telegram-user-id', '111')
      .send({})

    expect(res.status).toBe(423)
    expect(res.body.error.code).toBe('LOCKED')
  })

  it('PUT /api/admin/sync-schedule returns 423 when catalog source is crm', async () => {
    mockEnv.isCatalogCrmMode = true

    const res = await request(buildApp())
      .put('/api/admin/sync-schedule')
      .set('Authorization', 'Bearer admin-token')
      .set('x-telegram-user-id', '111')
      .send({ enabled: true, hourMsk: 4 })

    expect(res.status).toBe(423)
    expect(res.body.error.code).toBe('LOCKED')
    expect(mockUpdateSyncSchedule).not.toHaveBeenCalled()
  })

  it('PUT /api/admin/sync-schedule updates schedule when catalog source is sheets', async () => {
    mockEnv.isCatalogCrmMode = false

    const res = await request(buildApp())
      .put('/api/admin/sync-schedule')
      .set('Authorization', 'Bearer admin-token')
      .set('x-telegram-user-id', '111')
      .send({ enabled: true, hourMsk: 4 })

    expect(res.status).toBe(200)
    expect(mockUpdateSyncSchedule).toHaveBeenCalledWith({ enabled: true, hourMsk: 4 })
  })

  it('GET /api/admin/sync-schedule returns syncAvailable false in crm mode', async () => {
    mockEnv.isCatalogCrmMode = true

    const res = await request(buildApp())
      .get('/api/admin/sync-schedule')
      .set('Authorization', 'Bearer admin-token')
      .set('x-telegram-user-id', '111')

    expect(res.status).toBe(200)
    expect(res.body.data.syncAvailable).toBe(false)
  })

  it('GET /api/admin/sync-schedule returns syncAvailable true in sheets mode', async () => {
    mockEnv.isCatalogCrmMode = false

    const res = await request(buildApp())
      .get('/api/admin/sync-schedule')
      .set('Authorization', 'Bearer admin-token')
      .set('x-telegram-user-id', '111')

    expect(res.status).toBe(200)
    expect(res.body.data.syncAvailable).toBe(true)
  })
})
