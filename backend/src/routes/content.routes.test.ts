import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyAdminJwt = vi.fn()
const mockListCrmPages = vi.fn()
const mockListPublicCollections = vi.fn()

vi.mock('../services/admin-auth.service', () => ({
  verifyAdminJwt: (...args: unknown[]) => mockVerifyAdminJwt(...args),
}))

vi.mock('../services/content.service', () => ({
  listCrmPages: (...args: unknown[]) => mockListCrmPages(...args),
  listPublicCollections: (...args: unknown[]) => mockListPublicCollections(...args),
}))

import { errorHandler } from '../middleware/error-handler.middleware'
import { contentCrmRouter } from '../routes/content-crm.routes'
import { contentPublicRouter } from '../routes/content-public.routes'

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/crm/content', contentCrmRouter)
  app.use('/api/content', contentPublicRouter)
  app.use(errorHandler)
  return app
}

describe('content routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListPublicCollections.mockResolvedValue([])
  })

  it('CRM routes return 401 without admin_token cookie', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/crm/content/pages')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(mockListCrmPages).not.toHaveBeenCalled()
  })

  it('CRM routes return 200 with valid admin_token', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    mockListCrmPages.mockResolvedValue([])

    const app = buildApp()
    const res = await request(app)
      .get('/api/crm/content/pages')
      .set('Cookie', 'admin_token=valid')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: [], error: null })
    expect(mockListCrmPages).toHaveBeenCalledOnce()
  })

  it('public routes do not require auth', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/content/collections')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(mockListPublicCollections).toHaveBeenCalledOnce()
  })
})
