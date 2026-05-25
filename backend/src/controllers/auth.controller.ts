import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { signJwt } from '../services/jwt.service'
import { getDevFallbackUser, validateTelegramInitData } from '../services/telegram-auth.service'
import { pool } from '../utils/db'
import { env } from '../utils/env'
import { fail, HttpError, ok, zodErrorMessage } from '../utils/api-response'

const authSchema = z.object({
  initData: z.string().min(1),
})

export const telegramAuthHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = authSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    const { initData } = parsed.data

    let tgUser = validateTelegramInitData(initData, env.telegramBotToken)

    if (!tgUser && initData === 'dev_fallback') {
      tgUser = getDevFallbackUser(env.devTelegramUserId)
    }

    if (!tgUser) {
      return fail(res, 401, 'Invalid or expired Telegram initData', 'UNAUTHORIZED')
    }

    const client = await pool.connect()
    try {
      const result = await client.query<{ id: number }>(
        `INSERT INTO users (telegram_id, first_name, last_name, username, last_login_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (telegram_id)
         DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           username = EXCLUDED.username,
           last_login_at = NOW()
         RETURNING id`,
        [tgUser.id, tgUser.first_name ?? null, tgUser.last_name ?? null, tgUser.username ?? null],
      )
      const userId = result.rows[0].id
      const token = signJwt({ userId, telegramId: tgUser.id })

      return ok(res, {
        token,
        user: {
          id: userId,
          telegramId: tgUser.id,
          firstName: tgUser.first_name,
          username: tgUser.username,
        },
      })
    } finally {
      client.release()
    }
  } catch (error) {
    next(error)
  }
}
