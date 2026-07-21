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
const mockGetCrmPageBySlug = vi.fn()
const mockUpsertFixedPage = vi.fn()
const mockUpsertCompanyPage = vi.fn()
const mockUpsertVacancyPage = vi.fn()
const mockUpsertPartnersPage = vi.fn()

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
  getCrmPageBySlug: (...args: unknown[]) => mockGetCrmPageBySlug(...args),
  upsertFixedPage: (...args: unknown[]) => mockUpsertFixedPage(...args),
  upsertCompanyPage: (...args: unknown[]) => mockUpsertCompanyPage(...args),
  upsertVacancyPage: (...args: unknown[]) => mockUpsertVacancyPage(...args),
  upsertPartnersPage: (...args: unknown[]) => mockUpsertPartnersPage(...args),
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

  it('CRM get page by-slug returns page for allowlisted slug', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    mockGetCrmPageBySlug.mockResolvedValue({
      id: '3',
      slug: 'help',
      title: 'Клиентам',
      bodyHtml: '<p>Help</p>',
      heroImage: null,
      seoTitle: '',
      seoDescription: '',
      isVisible: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const app = buildApp()
    const res = await request(app)
      .get('/api/crm/content/pages/by-slug/help')
      .set('Cookie', 'admin_token=valid')

    expect(res.status).toBe(200)
    expect(res.body.data.slug).toBe('help')
    expect(mockGetCrmPageBySlug).toHaveBeenCalledWith('help')
  })

  it('CRM upsert page by-slug returns 400 for invalid slug', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    const { HttpError } = await import('../utils/api-response')
    mockUpsertFixedPage.mockRejectedValue(new HttpError(400, 'Invalid page slug', 'VALIDATION'))

    const app = buildApp()
    const res = await request(app)
      .put('/api/crm/content/pages/by-slug/privacy')
      .set('Cookie', 'admin_token=valid')
      .send({ bodyHtml: '<p>x</p>' })

    expect(res.status).toBe(400)
    expect(mockUpsertFixedPage).toHaveBeenCalledWith('privacy', { bodyHtml: '<p>x</p>' })
  })

  it('CRM upsert page by-slug saves allowlisted page', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    mockUpsertFixedPage.mockResolvedValue({
      id: '10',
      slug: 'contacts',
      title: 'Контакты',
      bodyHtml: '<p>Body</p>',
      heroImage: { url: '/uploads/a.jpg' },
      seoTitle: '',
      seoDescription: '',
      isVisible: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const app = buildApp()
    const res = await request(app)
      .put('/api/crm/content/pages/by-slug/contacts')
      .set('Cookie', 'admin_token=valid')
      .send({
        bodyHtml: '<p>Body</p>',
        heroImage: { url: '/uploads/a.jpg' },
      })

    expect(res.status).toBe(200)
    expect(res.body.data.slug).toBe('contacts')
    expect(mockUpsertFixedPage).toHaveBeenCalledWith('contacts', {
      bodyHtml: '<p>Body</p>',
      heroImage: { url: '/uploads/a.jpg' },
    })
  })

  it('CRM upsert company page requires sections', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })

    const app = buildApp()
    const res = await request(app)
      .put('/api/crm/content/pages/by-slug/company')
      .set('Cookie', 'admin_token=valid')
      .send({ title: 'О нас' })

    expect(res.status).toBe(400)
    expect(mockUpsertCompanyPage).not.toHaveBeenCalled()
    expect(mockUpsertFixedPage).not.toHaveBeenCalled()
  })

  it('CRM upsert company page saves sections', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    const sections = {
      hero: { image: null, heading: 'Тест', text: '<p>Текст</p>' },
      mission: { label: 'Миссия', heading: '', text: '', images: [null, null] },
      promo: {
        image: null,
        cards: [
          { key: 'vacancy', title: 'В', text: '' },
          { key: 'contacts', title: 'К', text: '' },
          { key: 'partners', title: 'П', text: '' },
        ],
      },
    }
    mockUpsertCompanyPage.mockResolvedValue({
      id: '20',
      slug: 'company',
      title: 'О нас',
      bodyHtml: '',
      heroImage: null,
      sections,
      seoTitle: '',
      seoDescription: '',
      isVisible: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const app = buildApp()
    const res = await request(app)
      .put('/api/crm/content/pages/by-slug/company')
      .set('Cookie', 'admin_token=valid')
      .send({ sections })

    expect(res.status).toBe(200)
    expect(res.body.data.sections.hero.heading).toBe('Тест')
    expect(mockUpsertCompanyPage).toHaveBeenCalledWith({ sections })
    expect(mockUpsertFixedPage).not.toHaveBeenCalled()
  })

  it('CRM upsert vacancy page requires sections', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })

    const app = buildApp()
    const res = await request(app)
      .put('/api/crm/content/pages/by-slug/vacancy')
      .set('Cookie', 'admin_token=valid')
      .send({ title: 'Вакансии' })

    expect(res.status).toBe(400)
    expect(mockUpsertVacancyPage).not.toHaveBeenCalled()
    expect(mockUpsertFixedPage).not.toHaveBeenCalled()
  })

  it('CRM upsert vacancy page saves sections', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    const sections = {
      hero: { image: null, heading: 'Вакансии', text: '<p>Текст</p>' },
      hr: { heading: 'HR', contactName: 'Анна', phone: '+7000', email: 'hr@example.com' },
      vacancies: {
        heading: 'Открытые',
        items: [
          {
            id: 'example-1',
            title: 'Менеджер',
            city: 'СПб',
            experience: '',
            format: '',
            salary: '',
            description: '',
          },
        ],
      },
    }
    mockUpsertVacancyPage.mockResolvedValue({
      id: '21',
      slug: 'vacancy',
      title: 'Вакансии',
      bodyHtml: '',
      heroImage: null,
      sections,
      seoTitle: '',
      seoDescription: '',
      isVisible: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const app = buildApp()
    const res = await request(app)
      .put('/api/crm/content/pages/by-slug/vacancy')
      .set('Cookie', 'admin_token=valid')
      .send({ sections })

    expect(res.status).toBe(200)
    expect(res.body.data.sections.hr.contactName).toBe('Анна')
    expect(mockUpsertVacancyPage).toHaveBeenCalledWith({ sections })
    expect(mockUpsertFixedPage).not.toHaveBeenCalled()
  })

  it('CRM upsert partners page requires sections', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })

    const app = buildApp()
    const res = await request(app)
      .put('/api/crm/content/pages/by-slug/partners')
      .set('Cookie', 'admin_token=valid')
      .send({ title: 'Партнерам' })

    expect(res.status).toBe(400)
    expect(mockUpsertPartnersPage).not.toHaveBeenCalled()
    expect(mockUpsertFixedPage).not.toHaveBeenCalled()
  })

  it('CRM upsert partners page saves sections', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    const sections = {
      hero: { image: null, heading: 'Стать партнёром', text: '<p>Текст</p>' },
    }
    mockUpsertPartnersPage.mockResolvedValue({
      id: '22',
      slug: 'partners',
      title: 'Партнерам',
      bodyHtml: '',
      heroImage: null,
      sections,
      seoTitle: '',
      seoDescription: '',
      isVisible: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const app = buildApp()
    const res = await request(app)
      .put('/api/crm/content/pages/by-slug/partners')
      .set('Cookie', 'admin_token=valid')
      .send({ title: 'Партнерам', sections })

    expect(res.status).toBe(200)
    expect(res.body.data.sections.hero.heading).toBe('Стать партнёром')
    expect(res.body.data.title).toBe('Партнерам')
    expect(mockUpsertPartnersPage).toHaveBeenCalledWith({ title: 'Партнерам', sections })
    expect(mockUpsertFixedPage).not.toHaveBeenCalled()
  })
})
