import { Router } from 'express'

import {
  getCatalogProductBySkuHandler,
  getCatalogProductsHandler,
  getCatalogTreeHandler,
} from '../controllers/catalog.controller'

const catalogRouter = Router()

catalogRouter.get('/tree', getCatalogTreeHandler)
catalogRouter.get('/products', getCatalogProductsHandler)
catalogRouter.get('/products/:sku', getCatalogProductBySkuHandler)

export { catalogRouter }
