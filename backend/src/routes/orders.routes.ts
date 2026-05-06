import { Router } from 'express'

import { createOrderHandler, getDraftOrderHandler, saveDraftOrderHandler } from '../controllers/orders.controller'

const ordersRouter = Router()

ordersRouter.get('/draft/:telegramUserId', getDraftOrderHandler)
ordersRouter.post('/draft/save', saveDraftOrderHandler)
ordersRouter.post('/create', createOrderHandler)

export { ordersRouter }
