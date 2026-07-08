import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyAdminJwt = vi.fn()
const mockProcessAndSaveUpload = vi.fn()

vi.mock('../services/admin-auth.service', () => ({
  verifyAdminJwt: (...args: unknown[]) => mockVerifyAdminJwt(...args),
}))

vi.mock('../services/content-upload.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/content-upload.service')>()
  return {
    ...actual,
    processAndSaveUpload: (...args: unknown[]) => mockProcessAndSaveUpload(...args),
  }
})

import { errorHandler } from '../middleware/error-handler.middleware'
import { contentCrmRouter } from '../routes/content-crm.routes'

const buildApp = () => {
  const app = express()
  app.use(cookieParser())
  app.use('/api/crm/content', contentCrmRouter)
  app.use(errorHandler)
  return app
}

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

describe('content upload routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProcessAndSaveUpload.mockResolvedValue({
      url: '/uploads/test.webp',
      width: 1,
      height: 1,
    })
  })

  it('returns 401 without admin_token cookie', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/content/upload')
      .attach('file', tinyPng, { filename: 'test.png', contentType: 'image/png' })

    expect(res.status).toBe(401)
    expect(mockProcessAndSaveUpload).not.toHaveBeenCalled()
  })

  it('returns 200 with valid cookie and file', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })

    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/content/upload')
      .set('Cookie', 'admin_token=valid')
      .attach('file', tinyPng, { filename: 'test.png', contentType: 'image/png' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      data: { url: '/uploads/test.webp', width: 1, height: 1 },
      error: null,
    })
    expect(mockProcessAndSaveUpload).toHaveBeenCalledOnce()
  })

  it('returns 400 when file field is missing', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })

    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/content/upload')
      .set('Cookie', 'admin_token=valid')

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION')
    expect(mockProcessAndSaveUpload).not.toHaveBeenCalled()
  })

  it('returns 400 for non-image mime type', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })

    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/content/upload')
      .set('Cookie', 'admin_token=valid')
      .attach('file', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })

    expect(res.status).toBe(400)
    expect(res.body.error?.message).toContain('JPEG')
    expect(mockProcessAndSaveUpload).not.toHaveBeenCalled()
  })

  it('returns 413 when file exceeds 10MB', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })

    const app = buildApp()
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0)
    const res = await request(app)
      .post('/api/crm/content/upload')
      .set('Cookie', 'admin_token=valid')
      .attach('file', oversized, { filename: 'big.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(413)
    expect(res.body.error?.message).toContain('10MB')
    expect(mockProcessAndSaveUpload).not.toHaveBeenCalled()
  })
})
