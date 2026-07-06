import type { NextFunction, Request, Response } from 'express'

import type { AdminJwtPayload, AdminRole } from '../services/admin-auth.service'
import { verifyAdminJwt } from '../services/admin-auth.service'
import { fail } from '../utils/api-response'

export type CrmRequest = Request & { crmAdmin?: AdminJwtPayload }

export const requireCrmAuth =
  (roles?: AdminRole[]) => (req: CrmRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.admin_token
    if (typeof token !== 'string' || token.length === 0) {
      return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    }

    const payload = verifyAdminJwt(token)
    if (!payload) {
      return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    }

    if (roles && roles.length > 0 && !roles.includes(payload.role)) {
      return fail(res, 403, 'Forbidden', 'FORBIDDEN')
    }

    req.crmAdmin = payload
    return next()
  }
