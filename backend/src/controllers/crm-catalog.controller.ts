import type { NextFunction, Request, Response } from 'express'

import {
  createCrmCatalogProductSchema,
  crmCatalogStockSchema,
  patchCrmCatalogProductSchema,
} from '../schemas/crm-catalog.schemas'
import { CatalogLockedError } from '../services/catalog-source.guard'
import {
  createCrmCatalogProduct,
  getCrmCatalogMeta,
  getCrmCatalogProductById,
  listCrmCatalogProducts,
  setCrmCatalogProductArchived,
  updateCrmCatalogProduct,
  updateCrmCatalogProductStock,
} from '../services/crm-catalog.service'
import { fail, HttpError, ok, zodErrorMessage } from '../utils/api-response'

const parseProductId = (req: Request, res: Response): number | null => {
  const parsed = Number(req.params.id)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(res, 400, 'Invalid product id', 'VALIDATION')
    return null
  }
  return parsed
}

const parseInStock = (value: unknown): 'in' | 'out' | 'all' | undefined => {
  if (value === 'in' || value === 'out' || value === 'all') return value
  return undefined
}

const parseArchived = (value: unknown): 'true' | 'false' | 'all' | undefined => {
  if (value === 'true' || value === 'false' || value === 'all') return value
  return undefined
}

const handleServiceError = (error: unknown, res: Response, next: NextFunction) => {
  if (error instanceof CatalogLockedError) {
    return fail(res, 423, error.message, 'LOCKED')
  }
  const statusCode =
    error instanceof Error && (error as Error & { statusCode?: number }).statusCode === 409
      ? 409
      : undefined
  if (statusCode === 409) {
    return fail(res, 409, error instanceof Error ? error.message : 'Conflict', 'CONFLICT')
  }
  if (error instanceof Error && error.message.startsWith('All dimension fields')) {
    return fail(res, 400, error.message, 'VALIDATION')
  }
  if (error instanceof Error && error.message === 'No fields to update') {
    return fail(res, 400, error.message, 'VALIDATION')
  }
  return next(error)
}

export const getCrmCatalogMetaHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return ok(res, getCrmCatalogMeta())
  } catch (error) {
    next(error)
  }
}

export const listCrmCatalogProductsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await listCrmCatalogProducts({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      subcategory: typeof req.query.subcategory === 'string' ? req.query.subcategory : undefined,
      inStock: parseInStock(req.query.inStock),
      archived: parseArchived(req.query.archived),
      page: req.query.page,
      pageSize: req.query.pageSize,
    })
    return ok(res, data)
  } catch (error) {
    next(error)
  }
}

export const getCrmCatalogProductByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseProductId(req, res)
    if (id == null) return

    const product = await getCrmCatalogProductById(id)
    if (!product) {
      return fail(res, 404, 'Product not found', 'NOT_FOUND')
    }
    return ok(res, product)
  } catch (error) {
    next(error)
  }
}

export const createCrmCatalogProductHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = createCrmCatalogProductSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    const product = await createCrmCatalogProduct(parsed.data)
    return ok(res, product, 201)
  } catch (error) {
    return handleServiceError(error, res, next)
  }
}

export const patchCrmCatalogProductHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseProductId(req, res)
    if (id == null) return

    const parsed = patchCrmCatalogProductSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    const product = await updateCrmCatalogProduct(id, parsed.data)
    if (!product) {
      return fail(res, 404, 'Product not found', 'NOT_FOUND')
    }
    return ok(res, product)
  } catch (error) {
    return handleServiceError(error, res, next)
  }
}

export const archiveCrmCatalogProductHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseProductId(req, res)
    if (id == null) return

    const product = await setCrmCatalogProductArchived(id, true)
    if (!product) {
      return fail(res, 404, 'Product not found', 'NOT_FOUND')
    }
    return ok(res, product)
  } catch (error) {
    return handleServiceError(error, res, next)
  }
}

export const unarchiveCrmCatalogProductHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseProductId(req, res)
    if (id == null) return

    const product = await setCrmCatalogProductArchived(id, false)
    if (!product) {
      return fail(res, 404, 'Product not found', 'NOT_FOUND')
    }
    return ok(res, product)
  } catch (error) {
    return handleServiceError(error, res, next)
  }
}

export const updateCrmCatalogProductStockHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseProductId(req, res)
    if (id == null) return

    const parsed = crmCatalogStockSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    const product = await updateCrmCatalogProductStock(id, parsed.data.inStock)
    if (!product) {
      return fail(res, 404, 'Product not found', 'NOT_FOUND')
    }
    return ok(res, product)
  } catch (error) {
    return handleServiceError(error, res, next)
  }
}
