import { Router } from 'express'

import {
  createBannerHandler,
  createCollectionHandler,
  createLookbookHandler,
  createPageHandler,
  deleteBannerHandler,
  deleteCollectionHandler,
  deleteLookbookHandler,
  deletePageHandler,
  getBannerHandler,
  getCollectionHandler,
  getLookbookHandler,
  getPageHandler,
  listBannersHandler,
  listCollectionsHandler,
  listLookbooksHandler,
  listPagesHandler,
  setCollectionProductsHandler,
  setLookbookImagesHandler,
  updateBannerHandler,
  updateCollectionHandler,
  updateLookbookHandler,
  updatePageHandler,
} from '../controllers/content-crm.controller'
import {
  uploadHandler,
  uploadMiddleware,
} from '../controllers/content-upload.controller'
import { requireCrmAuth } from '../middleware/require-crm-auth.middleware'

export const contentCrmRouter = Router()

contentCrmRouter.use(requireCrmAuth())

contentCrmRouter.post('/upload', uploadMiddleware, uploadHandler)

contentCrmRouter.get('/pages', listPagesHandler)
contentCrmRouter.post('/pages', createPageHandler)
contentCrmRouter.get('/pages/:id', getPageHandler)
contentCrmRouter.put('/pages/:id', updatePageHandler)
contentCrmRouter.delete('/pages/:id', deletePageHandler)

contentCrmRouter.get('/collections', listCollectionsHandler)
contentCrmRouter.post('/collections', createCollectionHandler)
contentCrmRouter.get('/collections/:id', getCollectionHandler)
contentCrmRouter.put('/collections/:id', updateCollectionHandler)
contentCrmRouter.delete('/collections/:id', deleteCollectionHandler)
contentCrmRouter.put('/collections/:id/products', setCollectionProductsHandler)

contentCrmRouter.get('/lookbooks', listLookbooksHandler)
contentCrmRouter.post('/lookbooks', createLookbookHandler)
contentCrmRouter.get('/lookbooks/:id', getLookbookHandler)
contentCrmRouter.put('/lookbooks/:id', updateLookbookHandler)
contentCrmRouter.delete('/lookbooks/:id', deleteLookbookHandler)
contentCrmRouter.put('/lookbooks/:id/images', setLookbookImagesHandler)

contentCrmRouter.get('/banners', listBannersHandler)
contentCrmRouter.post('/banners', createBannerHandler)
contentCrmRouter.get('/banners/:id', getBannerHandler)
contentCrmRouter.put('/banners/:id', updateBannerHandler)
contentCrmRouter.delete('/banners/:id', deleteBannerHandler)
