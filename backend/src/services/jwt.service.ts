import jwt from 'jsonwebtoken'

import { env } from '../utils/env'

export type JwtPayload = {
  userId: number
  telegramId: number
}

const TTL_SECONDS = 60 * 60 * 24 * 30 // 30 дней

export const signJwt = (payload: JwtPayload): string =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: TTL_SECONDS })

export const verifyJwt = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload
  } catch {
    return null
  }
}
