import { Router } from 'express'

import {
  archiveCrmCatalogProductHandler,
  createCrmCatalogProductHandler,
  getCrmCatalogMetaHandler,
  getCrmCatalogProductByIdHandler,
  listCrmCatalogProductsHandler,
  patchCrmCatalogProductHandler,
  unarchiveCrmCatalogProductHandler,
  updateCrmCatalogProductStockHandler,
} from '../controllers/crm-catalog.controller'
import { requireCrmAuth } from '../middleware/require-crm-auth.middleware'

export const crmCatalogRouter = Router()

crmCatalogRouter.use(requireCrmAuth())

crmCatalogRouter.get('/meta', getCrmCatalogMetaHandler)
crmCatalogRouter.get('/products', listCrmCatalogProductsHandler)
crmCatalogRouter.post('/products', createCrmCatalogProductHandler)
crmCatalogRouter.get('/products/:id', getCrmCatalogProductByIdHandler)
crmCatalogRouter.patch('/products/:id', patchCrmCatalogProductHandler)
crmCatalogRouter.post('/products/:id/archive', archiveCrmCatalogProductHandler)
crmCatalogRouter.post('/products/:id/unarchive', unarchiveCrmCatalogProductHandler)
crmCatalogRouter.put('/products/:id/stock', updateCrmCatalogProductStockHandler)
