import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import type { AuthenticatedRequest } from '../middleware/auth.middleware'
import { getProfileByTelegramUserId, upsertProfileByTelegramUserId } from '../services/profile.service'
import { fail, HttpError, ok, zodErrorMessage } from '../utils/api-response'

const profilePayloadSchema = z.object({
  telegramUserId: z.number().int().positive().optional(),
  fullName: z.string().default(''),
  phone: z.string().default(''),
  deliveryAddresses: z.array(z.string()).default([]),
})

export const getMyProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const profile = await getProfileByTelegramUserId(telegramUserId)
    return ok(res, profile)
  } catch (error) {
    next(error)
  }
}

export const saveMyProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const parsed = profilePayloadSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    const profile = await upsertProfileByTelegramUserId({ ...parsed.data, telegramUserId })
    return ok(res, profile)
  } catch (error) {
    next(error)
  }
}
