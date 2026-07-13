import { Router } from 'express'

import {
  cancelCrmOrderHandler,
  getCrmOrderByIdHandler,
  listCrmOrdersHandler,
  patchCrmOrderHandler,
} from '../controllers/crm-orders.controller'
import { requireCrmAuth } from '../middleware/require-crm-auth.middleware'

export const crmOrdersRouter = Router()

crmOrdersRouter.use(requireCrmAuth())

crmOrdersRouter.get('/', listCrmOrdersHandler)
crmOrdersRouter.get('/:id', getCrmOrderByIdHandler)
crmOrdersRouter.patch('/:id', patchCrmOrderHandler)
crmOrdersRouter.post('/:id/cancel', cancelCrmOrderHandler)
