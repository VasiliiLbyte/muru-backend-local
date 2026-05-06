import type { Request, Response } from 'express'
import { z } from 'zod'

import type { AuthenticatedRequest } from '../middleware/auth.middleware'
import { addFavorite, getFavoritesByTelegramUserId, removeFavorite } from '../services/favorites.service'

const favoritePayloadSchema = z.object({
  telegramUserId: z.number().int().positive().optional(),
  sku: z.string().min(1),
})

export const getMyFavoritesHandler = async (req: Request, res: Response) => {
  const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
  if (!telegramUserId) return res.status(401).json({ success: false, data: null, error: 'Unauthorized' })

  try {
    const favorites = await getFavoritesByTelegramUserId(telegramUserId)
    return res.json({ success: true, data: favorites, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load favorites',
    })
  }
}

export const addFavoriteHandler = async (req: Request, res: Response) => {
  const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
  if (!telegramUserId) return res.status(401).json({ success: false, data: null, error: 'Unauthorized' })

  const parsed = favoritePayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }

  try {
    await addFavorite({ ...parsed.data, telegramUserId })
    return res.json({ success: true, data: { sku: parsed.data.sku }, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to add favorite',
    })
  }
}

export const removeFavoriteHandler = async (req: Request, res: Response) => {
  const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
  if (!telegramUserId) return res.status(401).json({ success: false, data: null, error: 'Unauthorized' })

  const parsed = favoritePayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }

  try {
    await removeFavorite({ ...parsed.data, telegramUserId })
    return res.json({ success: true, data: { sku: parsed.data.sku }, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to remove favorite',
    })
  }
}

