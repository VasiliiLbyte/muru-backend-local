import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyAdminJwt = vi.fn()
const mockListCrmPages = vi.fn()
const mockListPublicCollections = vi.fn()
const mockListCrmLookbookHotspots = vi.fn()
const mockCreateLookbookHotspot = vi.fn()
const mockGetPublicLookbookBySlug = vi.fn()
const mockListPublicLookbooks = vi.fn()

vi.mock('../services/admin-auth.service', () => ({
  verifyAdminJwt: (...args: unknown[]) => mockVerifyAdminJwt(...args),
}))

vi.mock('../services/content.service', () => ({
  listCrmPages: (...args: unknown[]) => mockListCrmPages(...args),
  listPublicCollections: (...args: unknown[]) => mockListPublicCollections(...args),
  listCrmLookbooks: vi.fn(),
  getCrmLookbookById: vi.fn(),
  createLookbook: vi.fn(),
  updateLookbook: vi.fn(),
  deleteLookbook: vi.fn(),
  setLookbookImages: vi.fn(),
  getPublicLookbookBySlug: (...args: unknown[]) => mockGetPublicLookbookBySlug(...args),
  listPublicLookbooks: (...args: unknown[]) => mockListPublicLookbooks(...args),
  getPublicPageBySlug: vi.fn(),
  listPublicBanners: vi.fn(),
  listCrmCollections: vi.fn(),
  getCrmCollectionById: vi.fn(),
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  setCollectionProducts: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  getCrmPageById: vi.fn(),
  listCrmBanners: vi.fn(),
  getCrmBannerById: vi.fn(),
  createBanner: vi.fn(),
  updateBanner: vi.fn(),
  deleteBanner: vi.fn(),
}))

vi.mock('../services/content-hotspots.service', () => ({
  listCrmLookbookHotspots: (...args: unknown[]) => mockListCrmLookbookHotspots(...args),
  createLookbookHotspot: (...args: unknown[]) => mockCreateLookbookHotspot(...args),
  updateLookbookHotspot: vi.fn(),
  deleteLookbookHotspot: vi.fn(),
  listPublicHotspotsForLookbook: vi.fn(),
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

  it('CRM hotspot routes return 401 without admin_token cookie', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/crm/content/lookbooks/1/hotspots')
    expect(res.status).toBe(401)
    expect(mockListCrmLookbookHotspots).not.toHaveBeenCalled()
  })

  it('CRM hotspot create returns 201 with valid admin_token', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    mockCreateLookbookHotspot.mockResolvedValue({
      id: '1',
      lookbookId: '2',
      productId: 5,
      xPercent: 50,
      yPercent: 30,
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/content/lookbooks/2/hotspots')
      .set('Cookie', 'admin_token=valid')
      .send({ productId: 5, xPercent: 50, yPercent: 30 })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(mockCreateLookbookHotspot).toHaveBeenCalledWith(2, {
      productId: 5,
      xPercent: 50,
      yPercent: 30,
    })
  })

  it('public lookbook detail can include hotspots', async () => {
    mockGetPublicLookbookBySlug.mockResolvedValue({
      id: '1',
      slug: 'spring',
      title: 'Spring',
      images: [],
      seo: { title: 'Spring', description: 'Spring' },
      hotspots: [
        {
          id: '10',
          xPercent: 40,
          yPercent: 60,
          sortOrder: 0,
          product: { sku: 'MU0001', name: 'Vase', price: 1000, slug: '/catalog/a/b/MU0001/' },
        },
      ],
    })

    const app = buildApp()
    const res = await request(app).get('/api/content/lookbooks/spring')

    expect(res.status).toBe(200)
    expect(res.body.data.hotspots).toHaveLength(1)
    expect(res.body.data.hotspots[0].product.sku).toBe('MU0001')
  })
})
