import { Router } from 'express'

import {
  createInvoiceHandler,
  createPaymentHandler,
  createWebPaymentHandler,
  getPaymentIntentStatusHandler,
  getPaymentStatusHandler,
  getWebPaymentStatusHandler,
} from '../controllers/payments.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { rateLimitByIp } from '../middleware/simple-rate-limit'

const paymentsRouter = Router()

paymentsRouter.post('/create', requireAuth, createPaymentHandler)
paymentsRouter.post('/invoice', requireAuth, createInvoiceHandler)
paymentsRouter.post('/web/create', rateLimitByIp('payments:web:create', 10), createWebPaymentHandler)
paymentsRouter.get('/web/:paymentId/status', rateLimitByIp('payments:web:status', 30), getWebPaymentStatusHandler)
paymentsRouter.get('/intent/:intentId/status', requireAuth, getPaymentIntentStatusHandler)
paymentsRouter.get('/:paymentId/status', requireAuth, getPaymentStatusHandler)

export { paymentsRouter }
