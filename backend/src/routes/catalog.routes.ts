import { Router } from 'express'

import {
  getCatalogProductsHandler,
  getCatalogTreeHandler,
} from '../controllers/catalog.controller'

const catalogRouter = Router()

catalogRouter.get('/tree', getCatalogTreeHandler)
catalogRouter.get('/products', getCatalogProductsHandler)

export { catalogRouter }
