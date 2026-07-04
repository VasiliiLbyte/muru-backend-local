import { Router } from 'express'

import {
  getCatalogProductBySkuHandler,
  getCatalogProductsHandler,
  getCatalogTreeHandler,
  restockNotifyHandler,
} from '../controllers/catalog.controller'
import { rateLimitByIp } from '../middleware/simple-rate-limit'

const catalogRouter = Router()

catalogRouter.get('/tree', getCatalogTreeHandler)
catalogRouter.get('/products', getCatalogProductsHandler)
catalogRouter.get('/products/:sku', getCatalogProductBySkuHandler)
catalogRouter.post(
  '/restock-notify',
  rateLimitByIp('catalog:restock-notify', 5),
  restockNotifyHandler,
)

export { catalogRouter }
