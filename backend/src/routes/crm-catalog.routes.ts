import { Router } from 'express'

import {
  crmCatalogImportMiddleware,
  exportCrmCatalogHandler,
  importCrmCatalogHandler,
} from '../controllers/crm-catalog-import.controller'
import {
  crmCatalogUploadMiddleware,
  uploadCrmCatalogImageHandler,
} from '../controllers/crm-catalog-upload.controller'
import {
  archiveCrmCatalogProductHandler,
  createCrmCatalogProductHandler,
  createCrmCategoryHandler,
  createCrmCharacteristicHandler,
  createCrmSubcategoryHandler,
  deleteCrmCategoryHandler,
  deleteCrmSubcategoryHandler,
  getCrmCatalogMetaHandler,
  getCrmCatalogProductByIdHandler,
  listCrmCatalogProductsHandler,
  listCrmCategoriesHandler,
  listCrmCharacteristicsHandler,
  listCrmSubcategoriesHandler,
  patchCrmCatalogProductHandler,
  patchCrmCategoryHandler,
  patchCrmCharacteristicHandler,
  patchCrmSubcategoryHandler,
  renameCrmSubcategoryHandler,
  unarchiveCrmCatalogProductHandler,
  updateCrmCatalogProductStockHandler,
} from '../controllers/crm-catalog.controller'
import { requireCrmAuth } from '../middleware/require-crm-auth.middleware'

export const crmCatalogRouter = Router()

crmCatalogRouter.use(requireCrmAuth())

crmCatalogRouter.get('/meta', getCrmCatalogMetaHandler)

crmCatalogRouter.get('/categories', listCrmCategoriesHandler)
crmCatalogRouter.post('/categories', createCrmCategoryHandler)
crmCatalogRouter.post('/categories/rename-subcategory', renameCrmSubcategoryHandler)
crmCatalogRouter.patch('/categories/:id', patchCrmCategoryHandler)
crmCatalogRouter.delete('/categories/:id', deleteCrmCategoryHandler)
crmCatalogRouter.get('/categories/:id/subcategories', listCrmSubcategoriesHandler)
crmCatalogRouter.post('/categories/:id/subcategories', createCrmSubcategoryHandler)
crmCatalogRouter.patch('/categories/:id/subcategories/:subId', patchCrmSubcategoryHandler)
crmCatalogRouter.delete('/categories/:id/subcategories/:subId', deleteCrmSubcategoryHandler)

crmCatalogRouter.get('/characteristics', listCrmCharacteristicsHandler)
crmCatalogRouter.post('/characteristics', createCrmCharacteristicHandler)
crmCatalogRouter.patch('/characteristics/:id', patchCrmCharacteristicHandler)

crmCatalogRouter.post('/upload-image', crmCatalogUploadMiddleware, uploadCrmCatalogImageHandler)

crmCatalogRouter.get('/export', exportCrmCatalogHandler)
crmCatalogRouter.post('/import', crmCatalogImportMiddleware, importCrmCatalogHandler)

crmCatalogRouter.get('/products', listCrmCatalogProductsHandler)
crmCatalogRouter.post('/products', createCrmCatalogProductHandler)
crmCatalogRouter.get('/products/:id', getCrmCatalogProductByIdHandler)
crmCatalogRouter.patch('/products/:id', patchCrmCatalogProductHandler)
crmCatalogRouter.post('/products/:id/archive', archiveCrmCatalogProductHandler)
crmCatalogRouter.post('/products/:id/unarchive', unarchiveCrmCatalogProductHandler)
crmCatalogRouter.put('/products/:id/stock', updateCrmCatalogProductStockHandler)
