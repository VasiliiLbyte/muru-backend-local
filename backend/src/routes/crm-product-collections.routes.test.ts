import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyAdminJwt = vi.fn()
const mockGetProductCollectionIds = vi.fn()
const mockSetProductCollections = vi.fn()

vi.mock('../services/admin-auth.service', () => ({
  verifyAdminJwt: (...args: unknown[]) => mockVerifyAdminJwt(...args),
}))

vi.mock('../services/crm-product-collections.service', () => ({
  getProductCollectionIds: (...args: unknown[]) => mockGetProductCollectionIds(...args),
  setProductCollections: (...args: unknown[]) => mockSetProductCollections(...args),
}))

import { errorHandler } from '../middleware/error-handler.middleware'
import { crmProductCollectionsRouter } from './crm-product-collections.routes'

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/crm/products', crmProductCollectionsRouter)
  app.use(errorHandler)
  return app
}

describe('crm-product-collections.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
  })

  it('returns 401 without cookie', async () => {
    const res = await request(buildApp()).get('/api/crm/products/MU0001/collections')
    expect(res.status).toBe(401)
  })

  it('GET returns collectionIds', async () => {
    mockGetProductCollectionIds.mockResolvedValueOnce({ collectionIds: [1, 2] })
    const res = await request(buildApp())
      .get('/api/crm/products/MU0001/collections')
      .set('Cookie', 'admin_token=valid')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ collectionIds: [1, 2] })
    expect(mockGetProductCollectionIds).toHaveBeenCalledWith('MU0001')
  })

  it('PUT syncs collectionIds', async () => {
    mockSetProductCollections.mockResolvedValueOnce({ collectionIds: [3] })
    const res = await request(buildApp())
      .put('/api/crm/products/MU0001/collections')
      .set('Cookie', 'admin_token=valid')
      .send({ collectionIds: [3] })
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ collectionIds: [3] })
    expect(mockSetProductCollections).toHaveBeenCalledWith('MU0001', [3])
  })

  it('PUT rejects invalid body with 422', async () => {
    const res = await request(buildApp())
      .put('/api/crm/products/MU0001/collections')
      .set('Cookie', 'admin_token=valid')
      .send({ collectionIds: ['x'] })
    expect(res.status).toBe(422)
    expect(mockSetProductCollections).not.toHaveBeenCalled()
  })
})
