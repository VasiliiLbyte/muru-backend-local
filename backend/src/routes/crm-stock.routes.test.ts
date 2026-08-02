import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyAdminJwt = vi.fn()
const mockListStockMovements = vi.fn()

vi.mock('../services/admin-auth.service', () => ({
  verifyAdminJwt: (...args: unknown[]) => mockVerifyAdminJwt(...args),
}))

vi.mock('../services/crm-stock.service', async () => {
  const actual = await vi.importActual<typeof import('../services/crm-stock.service')>(
    '../services/crm-stock.service',
  )
  return {
    ...actual,
    listStockMovements: (...args: unknown[]) => mockListStockMovements(...args),
  }
})

import { errorHandler } from '../middleware/error-handler.middleware'
import { crmStockRouter } from '../routes/crm-stock.routes'
import { CrmStockValidationError } from '../services/crm-stock.service'

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/crm/stock', crmStockRouter)
  app.use(errorHandler)
  return app
}

describe('crm stock routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'manager' })
    mockListStockMovements.mockResolvedValue({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })
  })

  it('GET /api/crm/stock/movements returns 401 without admin_token cookie', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/crm/stock/movements')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(mockListStockMovements).not.toHaveBeenCalled()
  })

  it('GET /api/crm/stock/movements returns 200 with rows for manager', async () => {
    mockListStockMovements.mockResolvedValue({
      rows: [
        {
          id: 1,
          createdAt: '2026-08-01T12:00:00.000Z',
          productId: 3,
          productSku: 'MU0001',
          productName: 'Ваза',
          type: 'sale',
          delta: -1,
          stockAfter: 4,
          reason: 'Заказ #42',
          orderId: 42,
          actorType: 'system',
          actorAdminId: null,
          actorLabel: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    })

    const app = buildApp()
    const res = await request(app)
      .get('/api/crm/stock/movements?type=sale&q=MU&page=1&pageSize=20')
      .set('Cookie', ['admin_token=test'])

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.rows).toHaveLength(1)
    expect(res.body.data.rows[0].productSku).toBe('MU0001')
    expect(mockListStockMovements).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sale',
        q: 'MU',
        page: '1',
        pageSize: '20',
      }),
    )
  })

  it('GET /api/crm/stock/movements returns 400 for invalid type', async () => {
    mockListStockMovements.mockRejectedValue(new CrmStockValidationError('Некорректный тип движения: x'))
    const app = buildApp()
    const res = await request(app)
      .get('/api/crm/stock/movements?type=x')
      .set('Cookie', ['admin_token=test'])

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION')
  })
})
