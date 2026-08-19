import { Router } from 'express'

import {
  getCatalogProductBySkuHandler,
  getCatalogProductBySlugHandler,
  getCatalogProductsHandler,
  getCatalogSearchHandler,
  getCatalogSearchSuggestHandler,
  getCatalogTreeHandler,
  restockNotifyHandler,
} from '../controllers/catalog.controller'
import { rateLimitByIp } from '../middleware/simple-rate-limit'

const catalogRouter = Router()

catalogRouter.get('/tree', getCatalogTreeHandler)
catalogRouter.get('/search/suggest', rateLimitByIp('catalog:search-suggest', 60), getCatalogSearchSuggestHandler)
catalogRouter.get('/search', rateLimitByIp('catalog:search', 30), getCatalogSearchHandler)
catalogRouter.get('/products', getCatalogProductsHandler)
catalogRouter.get('/products/by-slug/:slug', getCatalogProductBySlugHandler)
catalogRouter.get('/products/:sku', getCatalogProductBySkuHandler)
catalogRouter.post(
  '/restock-notify',
  rateLimitByIp('catalog:restock-notify', 5),
  restockNotifyHandler,
)

export { catalogRouter }
