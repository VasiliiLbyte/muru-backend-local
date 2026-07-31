import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyAdminJwt = vi.fn()
const mockProcessAndSaveVideoUpload = vi.fn()

vi.mock('../services/admin-auth.service', () => ({
  verifyAdminJwt: (...args: unknown[]) => mockVerifyAdminJwt(...args),
}))

vi.mock('../services/content-video-upload.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/content-video-upload.service')>()
  return {
    ...actual,
    processAndSaveVideoUpload: (...args: unknown[]) => mockProcessAndSaveVideoUpload(...args),
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

describe('content video upload routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProcessAndSaveVideoUpload.mockResolvedValue({
      video: {
        url: '/uploads/test.mp4',
        mime: 'video/mp4',
        width: 1280,
        height: 720,
        durationSec: 5,
      },
      image: { url: '/uploads/test.webp', width: 1280, height: 720 },
    })
  })

  it('returns 401 without admin_token cookie', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/content/upload-video')
      .attach('file', Buffer.from('fake'), { filename: 'a.mp4', contentType: 'video/mp4' })

    expect(res.status).toBe(401)
    expect(mockProcessAndSaveVideoUpload).not.toHaveBeenCalled()
  })

  it('returns uploaded video + poster on success', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/content/upload-video')
      .set('Cookie', 'admin_token=valid')
      .attach('file', Buffer.from('fake-mp4'), { filename: 'a.mp4', contentType: 'video/mp4' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.video.url).toBe('/uploads/test.mp4')
    expect(res.body.data.image.url).toBe('/uploads/test.webp')
    expect(mockProcessAndSaveVideoUpload).toHaveBeenCalled()
  })

  it('returns 400 RU for invalid mime', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/content/upload-video')
      .set('Cookie', 'admin_token=valid')
      .attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' })

    expect(res.status).toBe(400)
    expect(res.body.error?.message).toContain('MP4')
    expect(mockProcessAndSaveVideoUpload).not.toHaveBeenCalled()
  })

  it('returns 413 when file exceeds 50MB', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    const app = buildApp()
    const oversized = Buffer.alloc(50 * 1024 * 1024 + 1, 0)
    const res = await request(app)
      .post('/api/crm/content/upload-video')
      .set('Cookie', 'admin_token=valid')
      .attach('file', oversized, { filename: 'big.mp4', contentType: 'video/mp4' })

    expect(res.status).toBe(413)
    expect(res.body.error?.message).toContain('50')
    expect(mockProcessAndSaveVideoUpload).not.toHaveBeenCalled()
  })
})
