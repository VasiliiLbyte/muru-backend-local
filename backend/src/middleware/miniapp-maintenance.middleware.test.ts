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

import {
  miniappMaintenanceMiddleware,
  miniappMaintenanceUnlessNoTelegramInitData,
} from './miniapp-maintenance.middleware'

const buildUnlessApp = () => {
  const app = express()
  app.get('/api/catalog/tree', miniappMaintenanceUnlessNoTelegramInitData, (_req, res) => {
    res.json({ ok: true })
  })
  app.get('/api/cdek/cities', miniappMaintenanceUnlessNoTelegramInitData, (_req, res) => {
    res.json({ ok: true })
  })
  app.post('/api/cdek/web/calculate', miniappMaintenanceUnlessNoTelegramInitData, (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

const buildStrictApp = () => {
  const app = express()
  app.get('/api/catalog/tree', miniappMaintenanceMiddleware, (_req, res) => {
    res.json({ ok: true })
  })
  app.get('/api/orders', miniappMaintenanceMiddleware, (_req, res) => {
    res.json({ ok: true })
  })
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

describe('miniappMaintenanceUnlessNoTelegramInitData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.maintenanceMode = false
    mockEnv.adminTelegramIds = [111]
  })

  it('passes through when maintenance is off', async () => {
    const res = await request(buildUnlessApp()).get('/api/catalog/tree')
    expect(res.status).toBe(200)
  })

  it('allows web requests without initData during maintenance', async () => {
    mockEnv.maintenanceMode = true

    const res = await request(buildUnlessApp()).get('/api/catalog/tree')

    expect(res.status).toBe(200)
    expect(mockResolveTelegramUserFromInitData).not.toHaveBeenCalled()
  })

  it('returns 503 for non-admin mini app shopper during maintenance', async () => {
    mockEnv.maintenanceMode = true
    mockResolveTelegramUserFromInitData.mockReturnValue({ id: 999 })

    const res = await request(buildUnlessApp())
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

    const res = await request(buildUnlessApp())
      .get('/api/catalog/tree')
      .set('x-telegram-init-data', 'admin-init')

    expect(res.status).toBe(200)
  })

  it('allows CDEK cities without initData during maintenance', async () => {
    mockEnv.maintenanceMode = true

    const res = await request(buildUnlessApp()).get('/api/cdek/cities')

    expect(res.status).toBe(200)
  })

  it('allows CDEK web calculate without initData during maintenance', async () => {
    mockEnv.maintenanceMode = true

    const res = await request(buildUnlessApp()).post('/api/cdek/web/calculate')

    expect(res.status).toBe(200)
  })
})

describe('miniappMaintenanceMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.maintenanceMode = false
    mockEnv.adminTelegramIds = [111]
  })

  it('passes through when maintenance is off', async () => {
    const res = await request(buildStrictApp()).get('/api/catalog/tree')
    expect(res.status).toBe(200)
  })

  it('returns 503 for non-admin when maintenance is on', async () => {
    mockEnv.maintenanceMode = true
    mockResolveTelegramUserFromInitData.mockReturnValue({ id: 999 })

    const res = await request(buildStrictApp())
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

    const res = await request(buildStrictApp())
      .get('/api/catalog/tree')
      .set('x-telegram-init-data', 'admin-init')

    expect(res.status).toBe(200)
  })

  it('blocks when maintenance is on and initData is missing', async () => {
    mockEnv.maintenanceMode = true

    const res = await request(buildStrictApp()).get('/api/catalog/tree')

    expect(res.status).toBe(503)
    expect(res.body.code).toBe('MAINTENANCE')
  })

  it('blocks orders for non-admin mini app shopper during maintenance', async () => {
    mockEnv.maintenanceMode = true
    mockResolveTelegramUserFromInitData.mockReturnValue({ id: 999 })

    const res = await request(buildStrictApp())
      .get('/api/orders')
      .set('x-telegram-init-data', 'user=999')

    expect(res.status).toBe(503)
    expect(res.body.code).toBe('MAINTENANCE')
  })
})
