import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import {
  getProductCollectionIds,
  setProductCollections,
} from '../services/crm-product-collections.service'
import { fail, ok, zodErrorMessage } from '../utils/api-response'

const putBodySchema = z
  .object({
    collectionIds: z.array(z.number().int().positive()),
  })
  .strict()

const parseSkuParam = (req: Request, res: Response): string | null => {
  const raw = typeof req.params.sku === 'string' ? req.params.sku : ''
  const sku = raw.trim()
  if (!sku) {
    fail(res, 400, 'Invalid SKU', 'VALIDATION')
    return null
  }
  return sku
}

export const getProductCollectionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sku = parseSkuParam(req, res)
    if (sku === null) return
    return ok(res, await getProductCollectionIds(sku))
  } catch (error) {
    return next(error)
  }
}

export const putProductCollectionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sku = parseSkuParam(req, res)
    if (sku === null) return

    const parsed = putBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 422, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    return ok(res, await setProductCollections(sku, parsed.data.collectionIds))
  } catch (error) {
    return next(error)
  }
}
