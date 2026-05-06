import type { Request, Response } from 'express'
import { z } from 'zod'

import { signJwt } from '../services/jwt.service'
import { getDevFallbackUser, validateTelegramInitData } from '../services/telegram-auth.service'
import { pool } from '../utils/db'
import { env } from '../utils/env'

const authSchema = z.object({
  initData: z.string().min(1),
})

export const telegramAuthHandler = async (req: Request, res: Response) => {
  const parsed = authSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'initData is required' })
  }

  const { initData } = parsed.data

  // Валидируем подпись
  let tgUser = validateTelegramInitData(initData, env.telegramBotToken)

  // Dev fallback (только в не-проде)
  if (!tgUser && initData === 'dev_fallback') {
    tgUser = getDevFallbackUser(env.devTelegramUserId)
  }

  if (!tgUser) {
    return res.status(401).json({ success: false, error: 'Invalid or expired Telegram initData' })
  }

  // Upsert пользователя в БД (таблица users)
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

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: userId,
          telegramId: tgUser.id,
          firstName: tgUser.first_name,
          username: tgUser.username,
        },
      },
    })
  } finally {
    client.release()
  }
}
