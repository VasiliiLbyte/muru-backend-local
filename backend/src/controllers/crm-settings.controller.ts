import type { NextFunction, Response } from 'express'

import type { CrmRequest } from '../middleware/require-crm-auth.middleware'
import {
  catalogPlaceholderSettingsInputSchema,
  cdekSettingsInputSchema,
  contactSettingsInputSchema,
  getIntegrationsStatus,
  getSiteSettings,
  requisitesSettingsInputSchema,
  updateCatalogPlaceholderSettings,
  updateCdekSettings,
  updateContactSettings,
  updateRequisitesSettings,
  updateYookassaSettings,
  yookassaSettingsInputSchema,
} from '../services/site-settings.service'
import { fail, HttpError, ok, zodErrorMessage } from '../utils/api-response'

export const getSiteSettingsHandler = async (
  _req: CrmRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    return ok(res, await getSiteSettings())
  } catch (error) {
    return next(error)
  }
}

export const updateContactSettingsHandler = async (
  req: CrmRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = contactSettingsInputSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 422, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await updateContactSettings(parsed.data))
  } catch (error) {
    return next(error)
  }
}

export const updateRequisitesSettingsHandler = async (
  req: CrmRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = requisitesSettingsInputSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 422, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await updateRequisitesSettings(parsed.data))
  } catch (error) {
    return next(error)
  }
}

export const updateCdekSettingsHandler = async (
  req: CrmRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = cdekSettingsInputSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 422, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await updateCdekSettings(parsed.data))
  } catch (error) {
    if (error instanceof HttpError) {
      return fail(res, error.status, error.message, error.code, error.details)
    }
    return next(error)
  }
}

export const updateYookassaSettingsHandler = async (
  req: CrmRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = yookassaSettingsInputSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 422, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await updateYookassaSettings(parsed.data))
  } catch (error) {
    return next(error)
  }
}

export const updateCatalogPlaceholderSettingsHandler = async (
  req: CrmRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = catalogPlaceholderSettingsInputSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 422, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    return ok(res, await updateCatalogPlaceholderSettings(parsed.data))
  } catch (error) {
    return next(error)
  }
}

export const getIntegrationsStatusHandler = (
  _req: CrmRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    return ok(res, getIntegrationsStatus())
  } catch (error) {
    return next(error)
  }
}
