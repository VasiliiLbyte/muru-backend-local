import { Router } from 'express'

import {
  createOrderHandler,
  getDraftOrderHandler,
  getMyOrdersHandler,
  saveDraftOrderHandler,
} from '../controllers/orders.controller'
import { requireAuth } from '../middleware/auth.middleware'

const ordersRouter = Router()

ordersRouter.use(requireAuth)
ordersRouter.get('/draft/:telegramUserId', getDraftOrderHandler)
ordersRouter.get('/my', getMyOrdersHandler)
ordersRouter.post('/draft/save', saveDraftOrderHandler)
ordersRouter.post('/create', createOrderHandler)

export { ordersRouter }
