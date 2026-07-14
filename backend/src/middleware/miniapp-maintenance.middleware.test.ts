import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  maintenanceMode: false,
  adminTelegramIds: [111],
}))

const mockResolveTelegramUserFromInitData = vi.hoisted(() => vi.fn())

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

vi.mock('../services/telegram-auth.service', () => ({
  resolveTelegramUserFromInitData: (...args: unknown[]) =>
    mockResolveTelegramUserFromInitData(...args),
}))

import { miniappMaintenanceMiddleware } from './miniapp-maintenance.middleware'

const buildApp = () => {
  const app = express()
  app.get('/api/catalog/tree', miniappMaintenanceMiddleware, (_req, res) => {
    res.json({ ok: true })
  })
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

describe('miniappMaintenanceMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.maintenanceMode = false
    mockEnv.adminTelegramIds = [111]
  })

  it('passes through when maintenance is off', async () => {
    const res = await request(buildApp()).get('/api/catalog/tree')
    expect(res.status).toBe(200)
  })

  it('returns 503 for non-admin when maintenance is on', async () => {
    mockEnv.maintenanceMode = true
    mockResolveTelegramUserFromInitData.mockReturnValue({ id: 999 })

    const res = await request(buildApp())
      .get('/api/catalog/tree')
      .set('x-telegram-init-data', 'user=999')

    expect(res.status).toBe(503)
    expect(res.body).toEqual({
      ok: false,
      code: 'MAINTENANCE',
      message: 'Магазин временно закрыт',
    })
  })

  it('allows admin telegram id during maintenance', async () => {
    mockEnv.maintenanceMode = true
    mockResolveTelegramUserFromInitData.mockReturnValue({ id: 111 })

    const res = await request(buildApp())
      .get('/api/catalog/tree')
      .set('x-telegram-init-data', 'admin-init')

    expect(res.status).toBe(200)
  })

  it('blocks when maintenance is on and initData is missing', async () => {
    mockEnv.maintenanceMode = true

    const res = await request(buildApp()).get('/api/catalog/tree')

    expect(res.status).toBe(503)
    expect(res.body.code).toBe('MAINTENANCE')
  })
})
