import type { NextFunction, Request, Response } from 'express'

import {
  bannerWriteSchema,
  collectionProductsSchema,
  collectionWriteSchema,
  hotspotPatchSchema,
  hotspotWriteSchema,
  lookbookImagesSchema,
  lookbookWriteSchema,
  pageWriteSchema,
  companyPageWriteSchema,
  fixedPageWriteSchema,
  parsePositiveIntParam,
  parseRouteParam,
} from '../schemas/content.schemas'
import * as hotspotService from '../services/content-hotspots.service'
import * as contentService from '../services/content.service'
import { fail, ok, zodErrorMessage } from '../utils/api-response'

const parseId = (req: Request, res: Response): number | null => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) {
    fail(res, 400, 'Invalid id', 'VALIDATION')
    return null
  }
  return id
}

const parseHotspotId = (req: Request, res: Response): number | null => {
  const id = parsePositiveIntParam(req.params.hotspotId)
  if (!id) {
    fail(res, 400, 'Invalid hotspot id', 'VALIDATION')
    return null
  }
  return id
}

// Pages

export const listPagesHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return ok(res, await contentService.listCrmPages())
  } catch (error) {
    return next(error)
  }
}

export const getPageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    return ok(res, await contentService.getCrmPageById(id))
  } catch (error) {
    return next(error)
  }
}

export const getPageBySlugHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = parseRouteParam(req.params.slug)
    if (!slug) {
      return fail(res, 400, 'Invalid slug', 'VALIDATION')
    }
    return ok(res, await contentService.getCrmPageBySlug(slug))
  } catch (error) {
    return next(error)
  }
}

export const upsertPageBySlugHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = parseRouteParam(req.params.slug)
    if (!slug) {
      return fail(res, 400, 'Invalid slug', 'VALIDATION')
    }
    if (slug === 'company') {
      const parsed = companyPageWriteSchema.safeParse(req.body)
      if (!parsed.success) {
        return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
      }
      return ok(res, await contentService.upsertCompanyPage(parsed.data))
    }
    const parsed = fixedPageWriteSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await contentService.upsertFixedPage(slug, parsed.data))
  } catch (error) {
    return next(error)
  }
}

export const createPageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = pageWriteSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await contentService.createPage(parsed.data), 201)
  } catch (error) {
    return next(error)
  }
}

export const updatePageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    const parsed = pageWriteSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await contentService.updatePage(id, parsed.data))
  } catch (error) {
    return next(error)
  }
}

export const deletePageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    await contentService.deletePage(id)
    return ok(res, { ok: true })
  } catch (error) {
    return next(error)
  }
}

// Collections

export const listCollectionsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return ok(res, await contentService.listCrmCollections())
  } catch (error) {
    return next(error)
  }
}

export const getCollectionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    return ok(res, await contentService.getCrmCollectionById(id))
  } catch (error) {
    return next(error)
  }
}

export const createCollectionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = collectionWriteSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await contentService.createCollection(parsed.data), 201)
  } catch (error) {
    return next(error)
  }
}

export const updateCollectionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    const parsed = collectionWriteSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await contentService.updateCollection(id, parsed.data))
  } catch (error) {
    return next(error)
  }
}

export const deleteCollectionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    await contentService.deleteCollection(id)
    return ok(res, { ok: true })
  } catch (error) {
    return next(error)
  }
}

export const setCollectionProductsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    const parsed = collectionProductsSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await contentService.setCollectionProducts(id, parsed.data))
  } catch (error) {
    return next(error)
  }
}

// Lookbooks

export const listLookbooksHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return ok(res, await contentService.listCrmLookbooks())
  } catch (error) {
    return next(error)
  }
}

export const getLookbookHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    return ok(res, await contentService.getCrmLookbookById(id))
  } catch (error) {
    return next(error)
  }
}

export const createLookbookHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = lookbookWriteSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await contentService.createLookbook(parsed.data), 201)
  } catch (error) {
    return next(error)
  }
}

export const updateLookbookHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    const parsed = lookbookWriteSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await contentService.updateLookbook(id, parsed.data))
  } catch (error) {
    return next(error)
  }
}

export const deleteLookbookHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    await contentService.deleteLookbook(id)
    return ok(res, { ok: true })
  } catch (error) {
    return next(error)
  }
}

export const setLookbookImagesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    const parsed = lookbookImagesSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await contentService.setLookbookImages(id, parsed.data))
  } catch (error) {
    return next(error)
  }
}

export const listLookbookHotspotsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    return ok(res, await hotspotService.listCrmLookbookHotspots(id))
  } catch (error) {
    return next(error)
  }
}

export const createLookbookHotspotHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    const parsed = hotspotWriteSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 422, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await hotspotService.createLookbookHotspot(id, parsed.data), 201)
  } catch (error) {
    return next(error)
  }
}

export const updateLookbookHotspotHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    const hotspotId = parseHotspotId(req, res)
    if (hotspotId === null) return undefined
    const parsed = hotspotPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 422, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await hotspotService.updateLookbookHotspot(id, hotspotId, parsed.data))
  } catch (error) {
    return next(error)
  }
}

export const deleteLookbookHotspotHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    const hotspotId = parseHotspotId(req, res)
    if (hotspotId === null) return undefined
    await hotspotService.deleteLookbookHotspot(id, hotspotId)
    return ok(res, { ok: true })
  } catch (error) {
    return next(error)
  }
}

// Banners

export const listBannersHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return ok(res, await contentService.listCrmBanners())
  } catch (error) {
    return next(error)
  }
}

export const getBannerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    return ok(res, await contentService.getCrmBannerById(id))
  } catch (error) {
    return next(error)
  }
}

export const createBannerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = bannerWriteSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await contentService.createBanner(parsed.data), 201)
  } catch (error) {
    return next(error)
  }
}

export const updateBannerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    const parsed = bannerWriteSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await contentService.updateBanner(id, parsed.data))
  } catch (error) {
    return next(error)
  }
}

export const deleteBannerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res)
    if (id === null) return undefined
    await contentService.deleteBanner(id)
    return ok(res, { ok: true })
  } catch (error) {
    return next(error)
  }
}
