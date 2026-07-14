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
})
