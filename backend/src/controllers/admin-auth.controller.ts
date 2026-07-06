import type { NextFunction, Request, Response, CookieOptions } from 'express'
import { z } from 'zod'

import { findAdminById, login, verifyAdminJwt } from '../services/admin-auth.service'
import { fail, ok, zodErrorMessage } from '../utils/api-response'
import { env } from '../utils/env'

const LOGIN_COOKIE_NAME = 'admin_token'
const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000

const COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'strict',
  path: '/api',
  maxAge: COOKIE_MAX_AGE_MS,
}

const COOKIE_CLEAR_OPTS: CookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'strict',
  path: '/api',
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    const authResult = await login(parsed.data.email, parsed.data.password)
    if (!authResult) {
      return fail(res, 401, 'Invalid credentials', 'UNAUTHORIZED')
    }

    res.cookie(LOGIN_COOKIE_NAME, authResult.token, COOKIE_OPTS)
    return ok(res, { email: authResult.email, role: authResult.role })
  } catch (error) {
    return next(error)
  }
}

export const logoutHandler = (_req: Request, res: Response) => {
  res.clearCookie(LOGIN_COOKIE_NAME, COOKIE_CLEAR_OPTS)
  return ok(res, { ok: true })
}

export const meHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.admin_token
    if (typeof token !== 'string' || token.length === 0) {
      return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    }

    const payload = verifyAdminJwt(token)
    if (!payload) {
      return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    }

    const admin = await findAdminById(payload.adminId)
    if (!admin || !admin.isActive) {
      return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    }

    return ok(res, { email: admin.email, role: admin.role })
  } catch (error) {
    return next(error)
  }
}
