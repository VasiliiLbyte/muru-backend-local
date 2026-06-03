import { Router } from 'express'

import {
  createInvoiceHandler,
  createPaymentHandler,
  getPaymentStatusHandler,
} from '../controllers/payments.controller'
import { requireAuth } from '../middleware/auth.middleware'

const paymentsRouter = Router()

paymentsRouter.post('/create', requireAuth, createPaymentHandler)
paymentsRouter.post('/invoice', requireAuth, createInvoiceHandler)
paymentsRouter.get('/:paymentId/status', requireAuth, getPaymentStatusHandler)

export { paymentsRouter }
