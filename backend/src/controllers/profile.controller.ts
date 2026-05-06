import type { Request, Response } from 'express'
import { z } from 'zod'

import { getProfileByTelegramUserId, upsertProfileByTelegramUserId } from '../services/profile.service'

const profilePayloadSchema = z.object({
  telegramUserId: z.number().int().positive(),
  fullName: z.string().default(''),
  phone: z.string().default(''),
  deliveryAddresses: z.array(z.string()).default([]),
})

const parseTelegramUserId = (req: Request): number => {
  const queryId = req.query.telegramUserId
  const headerId = req.header('x-telegram-user-id')
  return Number(queryId ?? headerId)
}

export const getMyProfileHandler = async (req: Request, res: Response) => {
  const telegramUserId = parseTelegramUserId(req)
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    return res.status(400).json({ success: false, data: null, error: 'Invalid telegramUserId' })
  }

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
  const parsed = profilePayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }

  try {
    const profile = await upsertProfileByTelegramUserId(parsed.data)
    return res.json({ success: true, data: profile, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to save profile',
    })
  }
}

