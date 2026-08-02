import type { NextFunction, Request, Response } from 'express'

import {
  CrmStockValidationError,
  listStockMovements,
} from '../services/crm-stock.service'
import { fail, ok } from '../utils/api-response'

export const listStockMovementsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await listStockMovements({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
      page: req.query.page,
      pageSize: req.query.pageSize,
    })
    return ok(res, data)
  } catch (error) {
    if (error instanceof CrmStockValidationError) {
      return fail(res, 400, error.message, 'VALIDATION')
    }
    next(error)
  }
}
