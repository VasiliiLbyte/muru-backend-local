import { Router } from 'express'

import {
  createOrderHandler,
  getDraftOrderHandler,
  getMyOrdersHandler,
  saveDraftOrderHandler,
} from '../controllers/orders.controller'

const ordersRouter = Router()

ordersRouter.get('/draft/:telegramUserId', getDraftOrderHandler)
ordersRouter.get('/my', getMyOrdersHandler)
ordersRouter.post('/draft/save', saveDraftOrderHandler)
ordersRouter.post('/create', createOrderHandler)

export { ordersRouter }
