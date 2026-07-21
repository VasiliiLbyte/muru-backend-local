import { Router } from 'express'

import {
  getProductCollectionsHandler,
  putProductCollectionsHandler,
} from '../controllers/crm-product-collections.controller'
import { requireCrmAuth } from '../middleware/require-crm-auth.middleware'

export const crmProductCollectionsRouter = Router()

crmProductCollectionsRouter.use(requireCrmAuth())

crmProductCollectionsRouter.get('/:sku/collections', getProductCollectionsHandler)
crmProductCollectionsRouter.put('/:sku/collections', putProductCollectionsHandler)
