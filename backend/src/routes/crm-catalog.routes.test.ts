import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyAdminJwt = vi.fn()
const mockGetCrmCatalogMeta = vi.fn()
const mockListCrmCatalogProducts = vi.fn()
const mockCreateCrmCatalogProduct = vi.fn()
const mockListCrmCategories = vi.fn()
const mockCreateCrmCategory = vi.fn()
const mockCreateCrmCharacteristic = vi.fn()
const mockUploadCrmCatalogImage = vi.fn()
const mockExportCrmCatalog = vi.fn()
const mockImportCrmCatalogFromBuffer = vi.fn()

vi.mock('../services/admin-auth.service', () => ({
  verifyAdminJwt: (...args: unknown[]) => mockVerifyAdminJwt(...args),
}))

vi.mock('../services/crm-catalog.service', () => ({
  getCrmCatalogMeta: (...args: unknown[]) => mockGetCrmCatalogMeta(...args),
  listCrmCatalogProducts: (...args: unknown[]) => mockListCrmCatalogProducts(...args),
  getCrmCatalogProductById: vi.fn(),
  createCrmCatalogProduct: (...args: unknown[]) => mockCreateCrmCatalogProduct(...args),
  updateCrmCatalogProduct: vi.fn(),
  setCrmCatalogProductArchived: vi.fn(),
  updateCrmCatalogProductStock: vi.fn(),
}))

vi.mock('../services/crm-catalog-categories.service', () => ({
  listCrmCategories: (...args: unknown[]) => mockListCrmCategories(...args),
  createCrmCategory: (...args: unknown[]) => mockCreateCrmCategory(...args),
  updateCrmCategory: vi.fn(),
  deleteCrmCategory: vi.fn(),
  renameCrmSubcategory: vi.fn(),
}))

vi.mock('../services/crm-catalog-characteristics.service', () => ({
  listCrmCharacteristics: vi.fn(),
  createCrmCharacteristic: (...args: unknown[]) => mockCreateCrmCharacteristic(...args),
  updateCrmCharacteristic: vi.fn(),
}))

vi.mock('../services/crm-catalog-image-upload.service', () => ({
  uploadCrmCatalogImage: (...args: unknown[]) => mockUploadCrmCatalogImage(...args),
}))

vi.mock('../services/crm-catalog-export.service', () => ({
  exportCrmCatalog: (...args: unknown[]) => mockExportCrmCatalog(...args),
}))

vi.mock('../services/crm-catalog-import.service', () => ({
  importCrmCatalogFromBuffer: (...args: unknown[]) => mockImportCrmCatalogFromBuffer(...args),
}))

import { errorHandler } from '../middleware/error-handler.middleware'
import { crmCatalogRouter } from '../routes/crm-catalog.routes'
import { CatalogLockedError } from '../services/catalog-source.guard'

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/crm/catalog', crmCatalogRouter)
  app.use(errorHandler)
  return app
}

describe('crm catalog routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    mockGetCrmCatalogMeta.mockReturnValue({ catalogSource: 'sheets', readOnly: true })
    mockListCrmCatalogProducts.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      catalogSource: 'sheets',
      readOnly: true,
    })
    mockListCrmCategories.mockResolvedValue([])
    mockExportCrmCatalog.mockResolvedValue({
      buffer: Buffer.from('xlsx-bytes'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'muru-catalog-2026-07-13.xlsx',
    })
    mockImportCrmCatalogFromBuffer.mockResolvedValue({
      dryRun: true,
      totalRows: 1,
      parsed: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      errors: [],
    })
  })

  it('GET /api/crm/catalog/products returns 401 without cookie', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/crm/catalog/products')
    expect(res.status).toBe(401)
    expect(mockListCrmCatalogProducts).not.toHaveBeenCalled()
  })

  it('GET /api/crm/catalog/products returns 200 with cookie', async () => {
    const app = buildApp()
    const res = await request(app)
      .get('/api/crm/catalog/products')
      .set('Cookie', 'admin_token=valid')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(mockListCrmCatalogProducts).toHaveBeenCalledOnce()
  })

  it('POST /api/crm/catalog/products returns 423 LOCKED in sheets mode', async () => {
    mockCreateCrmCatalogProduct.mockRejectedValue(new CatalogLockedError())
    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/catalog/products')
      .set('Cookie', 'admin_token=valid')
      .send({ sku: 'MU0001', name: 'Item', price: 100 })
    expect(res.status).toBe(423)
    expect(res.body.error.code).toBe('LOCKED')
  })

  it('POST /api/crm/catalog/products returns 201 in crm mode', async () => {
    mockCreateCrmCatalogProduct.mockResolvedValue({
      id: 1,
      sku: 'MU0001',
      name: 'Item',
      price: 100,
      discountPercent: 0,
      inStock: 0,
      isArchived: false,
      specs: {},
      imageUrls: [],
      imageUrl1: 'https://placehold.co/1200x1200?text=MURU',
      imageUrl2: 'https://placehold.co/1200x1200?text=MURU',
      categoryId: null,
      categoryName: null,
      webSubcategoryName: null,
      webSubcategorySlug: null,
      subcategory: null,
      subcategorySlug: null,
      color: null,
      size: null,
      colorTags: [],
      dimensionsLabel: '',
      weightGrams: 3000,
      dimLengthCm: 22,
      dimWidthCm: 12,
      dimHeightCm: 18,
      dimsSource: 'auto',
      weightSource: 'auto',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/catalog/products')
      .set('Cookie', 'admin_token=valid')
      .send({ sku: 'MU0001', name: 'Item', price: 100 })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
  })

  it('GET /api/crm/catalog/categories returns 200 with cookie', async () => {
    mockListCrmCategories.mockResolvedValue([
      { id: 1, name: 'Decor', slug: 'decor', coverImageUrl: null, coverDriveFilename: null, productCount: 3 },
    ])
    const app = buildApp()
    const res = await request(app)
      .get('/api/crm/catalog/categories')
      .set('Cookie', 'admin_token=valid')
    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(mockListCrmCategories).toHaveBeenCalledOnce()
  })

  it('POST /api/crm/catalog/categories returns 423 LOCKED in sheets mode', async () => {
    mockCreateCrmCategory.mockRejectedValue(new CatalogLockedError())
    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/catalog/categories')
      .set('Cookie', 'admin_token=valid')
      .send({ name: 'New Category' })
    expect(res.status).toBe(423)
    expect(res.body.error.code).toBe('LOCKED')
  })

  it('POST /api/crm/catalog/characteristics returns 201 in crm mode', async () => {
    mockCreateCrmCharacteristic.mockResolvedValue({ id: 1, name: 'Material', sortOrder: 0 })
    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/catalog/characteristics')
      .set('Cookie', 'admin_token=valid')
      .send({ name: 'Material' })
    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Material')
  })

  it('POST /api/crm/catalog/upload-image returns 423 LOCKED in sheets mode', async () => {
    mockUploadCrmCatalogImage.mockRejectedValue(new CatalogLockedError())
    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/catalog/upload-image')
      .set('Cookie', 'admin_token=valid')
      .attach('file', Buffer.from('fake'), { filename: 'test.jpg', contentType: 'image/jpeg' })
    expect(res.status).toBe(423)
    expect(res.body.error.code).toBe('LOCKED')
  })

  it('GET /api/crm/catalog/export returns 200 with attachment content-type', async () => {
    const app = buildApp()
    const res = await request(app)
      .get('/api/crm/catalog/export?format=xlsx')
      .set('Cookie', 'admin_token=valid')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('spreadsheetml')
    expect(res.headers['content-disposition']).toContain('attachment')
    expect(mockExportCrmCatalog).toHaveBeenCalledWith('xlsx')
  })

  it('POST /api/crm/catalog/import returns 423 LOCKED in sheets mode', async () => {
    mockImportCrmCatalogFromBuffer.mockRejectedValue(new CatalogLockedError())
    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/catalog/import')
      .set('Cookie', 'admin_token=valid')
      .attach('file', Buffer.from('fake'), {
        filename: 'catalog.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    expect(res.status).toBe(423)
    expect(res.body.error.code).toBe('LOCKED')
  })

  it('POST /api/crm/catalog/import?dryRun=true returns 200 with report', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/catalog/import?dryRun=true')
      .set('Cookie', 'admin_token=valid')
      .attach('file', Buffer.from('fake'), {
        filename: 'catalog.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.dryRun).toBe(true)
    expect(mockImportCrmCatalogFromBuffer).toHaveBeenCalledWith(expect.any(Buffer), true)
  })
})
