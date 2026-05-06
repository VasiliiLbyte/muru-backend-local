import type { Request, Response } from 'express'
import { z } from 'zod'

import { addFavorite, getFavoritesByTelegramUserId, removeFavorite } from '../services/favorites.service'

const favoritePayloadSchema = z.object({
  telegramUserId: z.number().int().positive(),
  sku: z.string().min(1),
})

const parseTelegramUserId = (req: Request): number => {
  const queryId = req.query.telegramUserId
  const headerId = req.header('x-telegram-user-id')
  return Number(queryId ?? headerId)
}

export const getMyFavoritesHandler = async (req: Request, res: Response) => {
  const telegramUserId = parseTelegramUserId(req)
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    return res.status(400).json({ success: false, data: null, error: 'Invalid telegramUserId' })
  }

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
  const parsed = favoritePayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }

  try {
    await addFavorite(parsed.data)
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
  const parsed = favoritePayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }

  try {
    await removeFavorite(parsed.data)
    return res.json({ success: true, data: { sku: parsed.data.sku }, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to remove favorite',
    })
  }
}

