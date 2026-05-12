import type { Request, Response } from 'express'
import { z } from 'zod'

import { notifyRestockRequestByTelegram } from '../services/order-notifications.service'
import { getCatalogProductBySku, getCatalogProducts, getCatalogTree } from '../services/catalog.service'

const restockPayloadSchema = z.object({
  telegramUserId: z.number().int().positive(),
  sku: z.string().min(1),
  productName: z.string().min(1),
})

export const getCatalogTreeHandler = async (_req: Request, res: Response) => {
  try {
    const tree = await getCatalogTree()
    res.json({ success: true, data: tree })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load catalog tree',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export const getCatalogProductsHandler = async (req: Request, res: Response) => {
  try {
    const filters = {
      category: req.query.category ? String(req.query.category) : undefined,
      categorySlug: req.query.categorySlug ? String(req.query.categorySlug) : undefined,
      subcategory: req.query.subcategory ? String(req.query.subcategory) : undefined,
      subcategorySlug: req.query.subcategorySlug ? String(req.query.subcategorySlug) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      color: req.query.color ? String(req.query.color) : undefined,
      size: req.query.size ? String(req.query.size) : undefined,
      priceMax: req.query.priceMax ? Number(req.query.priceMax) : undefined,
    }
    const products = await getCatalogProducts(filters)
    const debugEnabled = req.query.debug === '1'

    if (debugEnabled) {
      const effectiveCategorySlug = filters.subcategorySlug || filters.categorySlug || null
      const effectiveCategoryName = filters.subcategory || filters.category || null
      console.log(
        '[catalog-debug] filters',
        JSON.stringify({
          ...filters,
          effectiveCategorySlug,
          effectiveCategoryName,
          results: products.length,
        }),
      )
      return res.json({
        success: true,
        data: products,
        debug: {
          filters,
          effectiveCategorySlug,
          effectiveCategoryName,
          results: products.length,
        },
      })
    }

    res.json({ success: true, data: products })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load catalog products',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export const getCatalogProductBySkuHandler = async (req: Request, res: Response) => {
  try {
    const sku = String(req.params.sku || '').toUpperCase()
    if (!sku) {
      return res.status(400).json({ success: false, error: 'SKU is required' })
    }

    const product = await getCatalogProductBySku(sku)
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    return res.json({ success: true, data: product })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to load product details',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export const restockNotifyHandler = async (req: Request, res: Response) => {
  const parsed = restockPayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }

  try {
    await notifyRestockRequestByTelegram(parsed.data)
    return res.json({
      success: true,
      data: { notified: true },
      error: null,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to send restock notification',
    })
  }
}
