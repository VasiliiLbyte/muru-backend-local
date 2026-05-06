import type { Request, Response } from 'express'
import { z } from 'zod'

import type { AuthenticatedRequest } from '../middleware/auth.middleware'
import { getProfileByTelegramUserId, upsertProfileByTelegramUserId } from '../services/profile.service'

const profilePayloadSchema = z.object({
  telegramUserId: z.number().int().positive().optional(),
  fullName: z.string().default(''),
  phone: z.string().default(''),
  deliveryAddresses: z.array(z.string()).default([]),
})

export const getMyProfileHandler = async (req: Request, res: Response) => {
  const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
  if (!telegramUserId) return res.status(401).json({ success: false, data: null, error: 'Unauthorized' })

  try {
    const profile = await getProfileByTelegramUserId(telegramUserId)
    return res.json({ success: true, data: profile, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load profile',
    })
  }
}

export const saveMyProfileHandler = async (req: Request, res: Response) => {
  const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
  if (!telegramUserId) return res.status(401).json({ success: false, data: null, error: 'Unauthorized' })

  const parsed = profilePayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }

  try {
    const profile = await upsertProfileByTelegramUserId({ ...parsed.data, telegramUserId })
    return res.json({ success: true, data: profile, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to save profile',
    })
  }
}

