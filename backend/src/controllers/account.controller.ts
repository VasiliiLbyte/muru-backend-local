import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import {
  requireCustomerAuth,
  type CustomerAuthenticatedRequest,
} from '../middleware/require-customer-auth.middleware'
import { clientIp } from '../middleware/simple-rate-limit'
import {
  changePassword,
  CUSTOMER_PASSWORD_MIN_LENGTH,
  findCustomerById,
  forgotPassword,
  loginCustomer,
  logoutCustomer,
  refreshCustomerSession,
  registerCustomer,
  requiresCaptchaForLogin,
  resendVerifyEmail,
  resetPassword,
  toCustomerDto,
  updateCustomerProfile,
  verifyEmailToken,
} from '../services/customer-auth.service'
import {
  addCustomerFavorite,
  createAddress,
  deleteAddress,
  getCustomerOrder,
  getFavoritesByCustomerId,
  listAddresses,
  listCustomerOrders,
  removeCustomerFavorite,
  updateAddress,
} from '../services/customer-account.service'
import { CaptchaRejectedError, verifySmartCaptcha } from '../services/smartcaptcha.service'
import { fail, HttpError, ok, zodErrorMessage } from '../utils/api-response'
import { env } from '../utils/env'

const ensureModule = (res: Response): boolean => {
  if (!env.customerAccountsEnabled) {
    fail(res, 503, 'Customer account module is not configured', 'UPSTREAM')
    return false
  }
  return true
}

const mapServiceError = (error: unknown, next: NextFunction, res: Response) => {
  if (error instanceof CaptchaRejectedError) {
    return fail(res, 400, error.message, 'VALIDATION')
  }
  const err = error as Error & { status?: number; code?: string }
  if (typeof err.status === 'number') {
    return fail(
      res,
      err.status,
      err.message,
      (err.code as 'VALIDATION' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'CONFLICT' | 'UPSTREAM') || undefined,
    )
  }
  return next(error)
}

const requireCaptcha = async (token: string | undefined, req: Request): Promise<void> => {
  await verifySmartCaptcha(token, clientIp(req))
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(CUSTOMER_PASSWORD_MIN_LENGTH),
  fullName: z.string().min(1).max(200),
  phone: z.string().optional().nullable(),
  consentAccepted: z.literal(true),
  captchaToken: z.string().optional(),
})

const emailOnlySchema = z.object({
  email: z.string().email(),
  captchaToken: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().optional(),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(CUSTOMER_PASSWORD_MIN_LENGTH),
})

const mePutSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(1),
})

const passwordChangeSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(CUSTOMER_PASSWORD_MIN_LENGTH),
})

const addressSchema = z.object({
  label: z.string().max(100).optional(),
  city: z.string().min(1).max(200),
  cdekCityCode: z.number().int().positive().optional().nullable(),
  address: z.string().min(1).max(500),
  isDefault: z.boolean().optional(),
})

const favoriteSkuSchema = z.object({
  sku: z.string().min(1),
})

export const registerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureModule(res)) return
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    await requireCaptcha(parsed.data.captchaToken, req)
    const result = await registerCustomer(parsed.data)
    return ok(res, result, 201)
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const resendVerifyHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureModule(res)) return
    const parsed = emailOnlySchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    await requireCaptcha(parsed.data.captchaToken, req)
    const result = await resendVerifyEmail(parsed.data.email)
    return ok(res, result)
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const verifyEmailHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureModule(res)) return
    const token = typeof req.query.token === 'string' ? req.query.token : ''
    if (!token) return fail(res, 400, 'token is required', 'VALIDATION')
    const result = await verifyEmailToken(token)
    return ok(res, result)
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureModule(res)) return
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    const ip = clientIp(req)
    if (requiresCaptchaForLogin(ip, parsed.data.email)) {
      await requireCaptcha(parsed.data.captchaToken, req)
    }
    const result = await loginCustomer(parsed.data.email, parsed.data.password, ip)
    return ok(res, result)
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const logoutHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureModule(res)) return
    const parsed = refreshSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    const result = await logoutCustomer(parsed.data.refreshToken)
    return ok(res, result)
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const refreshHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureModule(res)) return
    const parsed = refreshSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    const result = await refreshCustomerSession(parsed.data.refreshToken)
    return ok(res, result)
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const forgotPasswordHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureModule(res)) return
    const parsed = emailOnlySchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    await requireCaptcha(parsed.data.captchaToken, req)
    const result = await forgotPassword(parsed.data.email)
    return ok(res, result)
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const resetPasswordHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureModule(res)) return
    const parsed = resetSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    const result = await resetPassword(parsed.data.token, parsed.data.password)
    return ok(res, result)
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const getMeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    const customer = await findCustomerById(customerId)
    if (!customer || !customer.isActive) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    return ok(res, { customer: toCustomerDto(customer) })
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const putMeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    const parsed = mePutSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    const customer = await updateCustomerProfile(customerId, parsed.data)
    return ok(res, { customer })
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const putMePasswordHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    const parsed = passwordChangeSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    const result = await changePassword(
      customerId,
      parsed.data.oldPassword,
      parsed.data.newPassword,
    )
    return ok(res, result)
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const listAddressesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    return ok(res, { addresses: await listAddresses(customerId) })
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const createAddressHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    const parsed = addressSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    const address = await createAddress(customerId, parsed.data)
    return ok(res, { address }, 201)
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const updateAddressHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    const addressId = Number(req.params.id)
    if (!Number.isInteger(addressId) || addressId <= 0) {
      return fail(res, 400, 'Invalid address id', 'VALIDATION')
    }
    const parsed = addressSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    const address = await updateAddress(customerId, addressId, parsed.data)
    return ok(res, { address })
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const deleteAddressHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    const addressId = Number(req.params.id)
    if (!Number.isInteger(addressId) || addressId <= 0) {
      return fail(res, 400, 'Invalid address id', 'VALIDATION')
    }
    await deleteAddress(customerId, addressId)
    return ok(res, { ok: true })
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const listOrdersHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    return ok(res, { orders: await listCustomerOrders(customerId) })
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const getOrderHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    const orderId = Number(req.params.id)
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return fail(res, 400, 'Invalid order id', 'VALIDATION')
    }
    return ok(res, { order: await getCustomerOrder(customerId, orderId) })
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const listFavoritesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    return ok(res, await getFavoritesByCustomerId(customerId))
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const addFavoriteHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    const parsed = favoriteSkuSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    await addCustomerFavorite(customerId, parsed.data.sku)
    return ok(res, { sku: parsed.data.sku })
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export const removeFavoriteHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as CustomerAuthenticatedRequest).customerAuth?.customerId
    if (!customerId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    const parsed = favoriteSkuSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    await removeCustomerFavorite(customerId, parsed.data.sku)
    return ok(res, { sku: parsed.data.sku })
  } catch (error) {
    return mapServiceError(error, next, res)
  }
}

export { requireCustomerAuth }
