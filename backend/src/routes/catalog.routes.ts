import { Router } from 'express'

import {
  getCatalogProductBySkuHandler,
  getCatalogProductBySlugHandler,
  getCatalogProductsHandler,
  getCatalogTreeHandler,
  restockNotifyHandler,
} from '../controllers/catalog.controller'
import { rateLimitByIp } from '../middleware/simple-rate-limit'

const catalogRouter = Router()

catalogRouter.get('/tree', getCatalogTreeHandler)
catalogRouter.get('/products', getCatalogProductsHandler)
catalogRouter.get('/products/by-slug/:slug', getCatalogProductBySlugHandler)
catalogRouter.get('/products/:sku', getCatalogProductBySkuHandler)
catalogRouter.post(
  '/restock-notify',
  rateLimitByIp('catalog:restock-notify', 5),
  restockNotifyHandler,
)

export { catalogRouter }
