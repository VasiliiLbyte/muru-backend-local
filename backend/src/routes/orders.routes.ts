import { Router } from 'express'

import {
  getDraftOrderHandler,
  getMyOrdersHandler,
  saveDraftOrderHandler,
  validatePromoHandler,
} from '../controllers/orders.controller'
import { requireAuth } from '../middleware/auth.middleware'

const ordersRouter = Router()

ordersRouter.use(requireAuth)
ordersRouter.get('/draft/:telegramUserId', getDraftOrderHandler)
ordersRouter.get('/my', getMyOrdersHandler)
ordersRouter.post('/draft/save', saveDraftOrderHandler)
ordersRouter.post('/promo/validate', validatePromoHandler)

export { ordersRouter }
