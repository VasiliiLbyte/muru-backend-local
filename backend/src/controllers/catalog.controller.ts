import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { notifyRestockRequestByTelegram } from '../services/order-notifications.service'
import { getCatalogProductBySku, getCatalogProducts, getCatalogTree } from '../services/catalog.service'
import { fail, HttpError, ok, zodErrorMessage } from '../utils/api-response'

const restockPayloadSchema = z.object({
  telegramUserId: z.number().int().positive(),
  sku: z.string().min(1),
  productName: z.string().min(1),
})

export const getCatalogTreeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const withSubcategories =
      req.query.subcategories === '1' || req.query.levels === '2'
    const tree = await getCatalogTree(withSubcategories)
    return ok(res, tree)
  } catch (error) {
    next(error)
  }
}

export const getCatalogProductsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      channel: req.query.channel ? String(req.query.channel) : undefined,
      category: req.query.category ? String(req.query.category) : undefined,
      categorySlug: req.query.categorySlug ? String(req.query.categorySlug) : undefined,
      subcategory: req.query.subcategory ? String(req.query.subcategory) : undefined,
      subcategorySlug: req.query.subcategorySlug ? String(req.query.subcategorySlug) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      color: req.query.color ? String(req.query.color) : undefined,
      size: req.query.size ? String(req.query.size) : undefined,
      priceMax: req.query.priceMax ? Number(req.query.priceMax) : undefined,
      giftGuide: req.query.giftGuide === 'true' ? true : undefined,
    }
    const products = await getCatalogProducts(filters)
    const debugEnabled = req.query.debug === '1'

    if (debugEnabled) {
      console.log(
        '[catalog-debug] filters',
        JSON.stringify({
          ...filters,
          results: products.length,
        }),
      )
      return ok(res, {
        products,
        debug: {
          filters,
          results: products.length,
        },
      })
    }

    return ok(res, products)
  } catch (error) {
    next(error)
  }
}

export const getCatalogProductBySkuHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sku = String(req.params.sku || '').toUpperCase()
    if (!sku) {
      return fail(res, 400, 'SKU is required', 'VALIDATION')
    }

    const channel = req.query.channel ? String(req.query.channel) : undefined
    const product = await getCatalogProductBySku(sku, channel)
    if (!product) {
      return fail(res, 404, 'Product not found', 'NOT_FOUND')
    }
    return ok(res, product)
  } catch (error) {
    next(error)
  }
}

export const restockNotifyHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = restockPayloadSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    await notifyRestockRequestByTelegram(parsed.data)
    return ok(res, { notified: true })
  } catch (error) {
    next(error)
  }
}
