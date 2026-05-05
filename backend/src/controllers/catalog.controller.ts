import type { Request, Response } from 'express'

import { getCatalogProducts, getCatalogTree } from '../services/catalog.service'

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
    const products = await getCatalogProducts({
      category: req.query.category ? String(req.query.category) : undefined,
      subcategory: req.query.subcategory ? String(req.query.subcategory) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      color: req.query.color ? String(req.query.color) : undefined,
      size: req.query.size ? String(req.query.size) : undefined,
      priceMax: req.query.priceMax ? Number(req.query.priceMax) : undefined,
    })
    res.json({ success: true, data: products })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load catalog products',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
