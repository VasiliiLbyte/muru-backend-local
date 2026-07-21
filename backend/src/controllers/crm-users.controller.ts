import type { NextFunction, Response } from 'express'
import { z } from 'zod'

import type { CrmRequest } from '../middleware/require-crm-auth.middleware'
import { PASSWORD_MIN_LENGTH } from '../services/admin-auth.service'
import {
  createCrmUser,
  deleteCrmUser,
  listCrmUsers,
  patchCrmUser,
  resetCrmUserPassword,
} from '../services/crm-users.service'
import { fail, ok, zodErrorMessage } from '../utils/api-response'

const createBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(PASSWORD_MIN_LENGTH),
    role: z.enum(['owner', 'manager']),
  })
  .strict()

const patchBodySchema = z
  .object({
    role: z.enum(['owner', 'manager']).optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((body) => body.role !== undefined || body.is_active !== undefined, {
    message: 'At least one of role or is_active is required',
  })

const passwordBodySchema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH),
  })
  .strict()

const parseUserId = (req: CrmRequest, res: Response): number | null => {
  const parsed = Number(req.params.id)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(res, 400, 'Invalid user id', 'VALIDATION')
    return null
  }
  return parsed
}

const requireActorId = (req: CrmRequest, res: Response): number | null => {
  const adminId = req.crmAdmin?.adminId
  if (typeof adminId !== 'number' || !Number.isInteger(adminId)) {
    fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    return null
  }
  return adminId
}

export const listCrmUsersHandler = async (req: CrmRequest, res: Response, next: NextFunction) => {
  try {
    return ok(res, await listCrmUsers())
  } catch (error) {
    return next(error)
  }
}

export const createCrmUserHandler = async (req: CrmRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 422, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    const user = await createCrmUser(parsed.data)
    return ok(res, user, 201)
  } catch (error) {
    return next(error)
  }
}

export const patchCrmUserHandler = async (req: CrmRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseUserId(req, res)
    if (id === null) return
    const actorId = requireActorId(req, res)
    if (actorId === null) return

    const parsed = patchBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    return ok(res, await patchCrmUser(id, parsed.data, actorId))
  } catch (error) {
    return next(error)
  }
}

export const resetCrmUserPasswordHandler = async (
  req: CrmRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseUserId(req, res)
    if (id === null) return

    const parsed = passwordBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 422, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    await resetCrmUserPassword(id, parsed.data.password)
    return ok(res, { ok: true })
  } catch (error) {
    return next(error)
  }
}

export const deleteCrmUserHandler = async (req: CrmRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseUserId(req, res)
    if (id === null) return
    const actorId = requireActorId(req, res)
    if (actorId === null) return

    await deleteCrmUser(id, actorId)
    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}
