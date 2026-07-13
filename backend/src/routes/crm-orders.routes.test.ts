import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CrmOrderDetail } from '../services/crm-orders.service'

const mockVerifyAdminJwt = vi.fn()
const mockListCrmOrders = vi.fn()
const mockGetCrmOrderById = vi.fn()
const mockUpdateCrmOrder = vi.fn()
const mockCancelCrmOrder = vi.fn()
const mockNotifyClientStatusChange = vi.fn()

vi.mock('../services/admin-auth.service', () => ({
  verifyAdminJwt: (...args: unknown[]) => mockVerifyAdminJwt(...args),
}))

vi.mock('../services/crm-orders.service', () => ({
  listCrmOrders: (...args: unknown[]) => mockListCrmOrders(...args),
  getCrmOrderById: (...args: unknown[]) => mockGetCrmOrderById(...args),
  updateCrmOrder: (...args: unknown[]) => mockUpdateCrmOrder(...args),
  cancelCrmOrder: (...args: unknown[]) => mockCancelCrmOrder(...args),
  crmOrderDetailToOrderDraft: (detail: CrmOrderDetail) => ({
    id: detail.id,
    telegramUserId: detail.telegramUserId,
    status: detail.status,
    deliveryMode: detail.deliveryMode,
    deliveryOption: detail.deliveryOption,
    deliveryPrice: detail.deliveryPrice,
    deliveryEta: detail.deliveryEta,
    address: detail.address,
    comment: detail.comment,
    birthDate: null,
    subtotal: detail.subtotal,
    total: detail.total,
    items: detail.items,
  }),
}))

vi.mock('../services/order-notifications.service', () => ({
  notifyClientStatusChange: (...args: unknown[]) => mockNotifyClientStatusChange(...args),
}))

import { errorHandler } from '../middleware/error-handler.middleware'
import { crmOrdersRouter } from '../routes/crm-orders.routes'

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/crm/orders', crmOrdersRouter)
  app.use(errorHandler)
  return app
}

const baseOrder = (overrides: Partial<CrmOrderDetail> = {}): CrmOrderDetail => ({
  id: 1,
  channel: 'telegram',
  telegramUserId: 123,
  status: 'Новый',
  total: 1000,
  subtotal: 900,
  deliveryMode: 'delivery',
  deliveryOption: 'cdek',
  deliveryPrice: 100,
  deliveryEta: null,
  address: 'addr',
  comment: '',
  adminComment: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  itemsCount: 1,
  customerName: 'Ivan',
  customerPhone: '+7999',
  paymentStatus: null,
  paidAt: null,
  paymentId: null,
  promoCode: null,
  promoDiscount: 0,
  consentAccepted: false,
  consentVersion: null,
  consentAcceptedAt: null,
  cdekTariffCode: null,
  cdekCityCode: null,
  cdekCityName: null,
  cdekPvzCode: null,
  cdekPvzAddress: null,
  cdekRecipientName: null,
  cdekRecipientPhone: null,
  cdekSyncState: 'none',
  cdekUuid: null,
  cdekTrackNumber: null,
  cdekStatus: null,
  cdekStatusUpdatedAt: null,
  cdekCreateError: null,
  items: [{ sku: 'MU0001', name: 'Item', price: 900, quantity: 1, imageUrl: null }],
  ...overrides,
})

describe('crm orders routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
    mockListCrmOrders.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      statusCounts: {},
    })
    mockNotifyClientStatusChange.mockResolvedValue(undefined)
  })

  it('GET /api/crm/orders returns 401 without admin_token cookie', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/crm/orders')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(mockListCrmOrders).not.toHaveBeenCalled()
  })

  it('GET /api/crm/orders passes channel=web filter to service', async () => {
    const app = buildApp()
    const res = await request(app)
      .get('/api/crm/orders?channel=web')
      .set('Cookie', 'admin_token=valid')

    expect(res.status).toBe(200)
    expect(mockListCrmOrders).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'web' }),
    )
  })

  it('GET /api/crm/orders/:id returns 404 when order not found', async () => {
    mockGetCrmOrderById.mockResolvedValue(null)
    const app = buildApp()
    const res = await request(app)
      .get('/api/crm/orders/99')
      .set('Cookie', 'admin_token=valid')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('PATCH /api/crm/orders/:id returns 400 for invalid status', async () => {
    const app = buildApp()
    const res = await request(app)
      .patch('/api/crm/orders/1')
      .set('Cookie', 'admin_token=valid')
      .send({ status: 'invalid-status' })

    expect(res.status).toBe(400)
    expect(mockUpdateCrmOrder).not.toHaveBeenCalled()
  })

  it('PATCH /api/crm/orders/:id returns 400 for extra field (.strict())', async () => {
    const app = buildApp()
    const res = await request(app)
      .patch('/api/crm/orders/1')
      .set('Cookie', 'admin_token=valid')
      .send({ status: 'Новый', managerTelegramId: 1 })

    expect(res.status).toBe(400)
    expect(mockUpdateCrmOrder).not.toHaveBeenCalled()
  })

  it('PATCH telegram order to Подтверждён calls notifyClientStatusChange', async () => {
    const order = baseOrder({ channel: 'telegram', telegramUserId: 555, status: 'Подтверждён' })
    mockUpdateCrmOrder.mockResolvedValue({
      order,
      previousStatus: 'Новый',
    })

    const app = buildApp()
    const res = await request(app)
      .patch('/api/crm/orders/1')
      .set('Cookie', 'admin_token=valid')
      .send({ status: 'Подтверждён' })

    expect(res.status).toBe(200)
    expect(mockNotifyClientStatusChange).toHaveBeenCalledOnce()
  })

  it('PATCH web order to Подтверждён does not call notifyClientStatusChange', async () => {
    const order = baseOrder({
      channel: 'web',
      telegramUserId: null,
      status: 'Подтверждён',
      customerName: 'Web User',
      customerPhone: '+7888',
    })
    mockUpdateCrmOrder.mockResolvedValue({
      order,
      previousStatus: 'Новый',
    })

    const app = buildApp()
    const res = await request(app)
      .patch('/api/crm/orders/1')
      .set('Cookie', 'admin_token=valid')
      .send({ status: 'Подтверждён' })

    expect(res.status).toBe(200)
    expect(mockNotifyClientStatusChange).not.toHaveBeenCalled()
  })

  it('POST /api/crm/orders/:id/cancel returns cancelled order', async () => {
    const order = baseOrder({ status: 'Отменён' })
    mockCancelCrmOrder.mockResolvedValue(order)

    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/orders/1/cancel')
      .set('Cookie', 'admin_token=valid')

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('Отменён')
    expect(mockCancelCrmOrder).toHaveBeenCalledWith(1)
  })

  it('POST /api/crm/orders/:id/cancel returns 409 when already cancelled', async () => {
    const err = new Error('Order is already cancelled')
    ;(err as Error & { statusCode?: number }).statusCode = 409
    mockCancelCrmOrder.mockRejectedValue(err)

    const app = buildApp()
    const res = await request(app)
      .post('/api/crm/orders/1/cancel')
      .set('Cookie', 'admin_token=valid')

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
  })
})
