import { Router } from 'express'

import { listStockMovementsHandler } from '../controllers/crm-stock.controller'
import { requireCrmAuth } from '../middleware/require-crm-auth.middleware'

export const crmStockRouter = Router()

crmStockRouter.use(requireCrmAuth())

crmStockRouter.get('/movements', listStockMovementsHandler)
