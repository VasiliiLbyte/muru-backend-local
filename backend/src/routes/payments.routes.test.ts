import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  payments: { nativeEnabled: true },
  yookassa: { enabled: true },
}))

const mockCreateInvoiceForCheckout = vi.fn()
const mockVerifyJwt = vi.fn()

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

vi.mock('../services/jwt.service', () => ({
  verifyJwt: (...args: unknown[]) => mockVerifyJwt(...args),
}))

vi.mock('../services/telegram/invoice.service', () => ({
  createInvoiceForCheckout: (...args: unknown[]) => mockCreateInvoiceForCheckout(...args),
}))

import { errorHandler } from '../middleware/error-handler.middleware'
import { paymentsRouter } from './payments.routes'

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/payments', paymentsRouter)
  app.use(errorHandler)
  return app
}

const checkoutBody = {
  items: [{ sku: 'MU0001', quantity: 1 }],
  promoCode: null,
  deliveryMode: 'pickup',
  deliveryOption: null,
  deliveryEta: null,
  address: '',
  comment: '',
  birthDate: null,
  recipientName: 'Test User',
  recipientPhone: '+79001234567',
  cdekTariffCode: null,
  cdekCityCode: null,
  cdekCityName: null,
  cdekPvzCode: null,
  cdekPvzAddress: null,
}

describe('POST /api/payments/invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.payments.nativeEnabled = true
    mockVerifyJwt.mockReturnValue({ userId: 1, telegramId: 123 })
  })

  it('returns 200 and t.me invoiceUrl on success', async () => {
    mockCreateInvoiceForCheckout.mockResolvedValue({
      invoiceUrl: 'https://t.me/$invoice/abc123',
      intentId: 7,
    })

    const res = await request(buildApp())
      .post('/api/payments/invoice')
      .set('Authorization', 'Bearer valid-token')
      .send(checkoutBody)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.invoiceUrl).toMatch(/^https:\/\/t\.me\/\$/)
    expect(res.body.data.intentId).toBe(7)
  })

  it('returns 200 and normalized t.me invoiceUrl for telegram.me input', async () => {
    const normalizedUrl = 'https://t.me/$eZBtH8-abc'
    mockCreateInvoiceForCheckout.mockResolvedValue({
      invoiceUrl: normalizedUrl,
      intentId: 7,
    })

    const res = await request(buildApp())
      .post('/api/payments/invoice')
      .set('Authorization', 'Bearer valid-token')
      .send(checkoutBody)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.invoiceUrl).toBe(normalizedUrl)
    expect(res.body.data.intentId).toBe(7)
  })

  it('returns 500 when Telegram invoice creation fails', async () => {
    mockCreateInvoiceForCheckout.mockRejectedValue(
      new Error('Telegram API createInvoiceLink failed: {"ok":false}'),
    )

    const res = await request(buildApp())
      .post('/api/payments/invoice')
      .set('Authorization', 'Bearer valid-token')
      .send(checkoutBody)

    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('INTERNAL')
    expect(res.body.data).toBeNull()
  })

  it('returns 503 when native payments are disabled', async () => {
    mockEnv.payments.nativeEnabled = false

    const res = await request(buildApp())
      .post('/api/payments/invoice')
      .set('Authorization', 'Bearer valid-token')
      .send(checkoutBody)

    expect(res.status).toBe(503)
    expect(res.body.success).toBe(false)
  })
})
