import { Router } from 'express'

import {
  getCollectionBySlugHandler,
  getLookbookBySlugHandler,
  getPageBySlugHandler,
  listBannersHandler,
  listCollectionsHandler,
  listLookbooksHandler,
} from '../controllers/content-public.controller'

export const contentPublicRouter = Router()

contentPublicRouter.get('/pages/:slug', getPageBySlugHandler)
contentPublicRouter.get('/collections', listCollectionsHandler)
contentPublicRouter.get('/collections/:slug', getCollectionBySlugHandler)
contentPublicRouter.get('/lookbooks', listLookbooksHandler)
contentPublicRouter.get('/lookbooks/:slug', getLookbookBySlugHandler)
contentPublicRouter.get('/banners', listBannersHandler)
