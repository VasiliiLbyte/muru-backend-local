import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import type { AuthenticatedRequest } from '../middleware/auth.middleware'
import { addFavorite, getFavoritesByTelegramUserId, removeFavorite } from '../services/favorites.service'
import { fail, HttpError, ok, zodErrorMessage } from '../utils/api-response'

const favoritePayloadSchema = z.object({
  telegramUserId: z.number().int().positive().optional(),
  sku: z.string().min(1),
})

export const getMyFavoritesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const favorites = await getFavoritesByTelegramUserId(telegramUserId)
    return ok(res, favorites)
  } catch (error) {
    next(error)
  }
}

export const addFavoriteHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const parsed = favoritePayloadSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    await addFavorite({ ...parsed.data, telegramUserId })
    return ok(res, { sku: parsed.data.sku })
  } catch (error) {
    next(error)
  }
}

export const removeFavoriteHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const parsed = favoritePayloadSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    await removeFavorite({ ...parsed.data, telegramUserId })
    return ok(res, { sku: parsed.data.sku })
  } catch (error) {
    next(error)
  }
}
