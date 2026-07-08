import type { NextFunction, Request, Response } from 'express'

import * as contentService from '../services/content.service'
import { parseRouteParam } from '../schemas/content.schemas'
import { ok } from '../utils/api-response'

export const getPageBySlugHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return ok(res, await contentService.getPublicPageBySlug(parseRouteParam(req.params.slug)))
  } catch (error) {
    return next(error)
  }
}

export const listCollectionsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return ok(res, await contentService.listPublicCollections())
  } catch (error) {
    return next(error)
  }
}

export const getCollectionBySlugHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    return ok(res, await contentService.getPublicCollectionBySlug(parseRouteParam(req.params.slug)))
  } catch (error) {
    return next(error)
  }
}

export const listLookbooksHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return ok(res, await contentService.listPublicLookbooks())
  } catch (error) {
    return next(error)
  }
}

export const getLookbookBySlugHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return ok(res, await contentService.getPublicLookbookBySlug(parseRouteParam(req.params.slug)))
  } catch (error) {
    return next(error)
  }
}

export const listBannersHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return ok(res, await contentService.listPublicBanners())
  } catch (error) {
    return next(error)
  }
}
