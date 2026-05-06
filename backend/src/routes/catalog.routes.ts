import { Router } from 'express'

import {
  getCatalogProductBySkuHandler,
  getCatalogProductsHandler,
  getCatalogTreeHandler,
  restockNotifyHandler,
} from '../controllers/catalog.controller'

const catalogRouter = Router()

catalogRouter.get('/tree', getCatalogTreeHandler)
catalogRouter.get('/products', getCatalogProductsHandler)
catalogRouter.get('/products/:sku', getCatalogProductBySkuHandler)
catalogRouter.post('/restock-notify', restockNotifyHandler)

export { catalogRouter }
