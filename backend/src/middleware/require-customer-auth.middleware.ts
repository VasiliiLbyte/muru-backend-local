import type { NextFunction, Request, Response } from 'express'

import { verifyCustomerAccessJwt } from '../services/customer-auth.service'
import { fail } from '../utils/api-response'
import { env } from '../utils/env'

export type CustomerAuthenticatedRequest = Request & {
  customerAuth?: {
    customerId: number
  }
}

export const requireCustomerAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!env.customerAccountsEnabled) {
    return fail(res, 503, 'Customer account module is not configured', 'UPSTREAM')
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return fail(res, 401, 'Authorization token is required', 'UNAUTHORIZED')
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const payload = verifyCustomerAccessJwt(token)
  if (!payload) {
    return fail(res, 401, 'Invalid or expired token', 'UNAUTHORIZED')
  }

  ;(req as CustomerAuthenticatedRequest).customerAuth = {
    customerId: payload.customerId,
  }
  return next()
}
