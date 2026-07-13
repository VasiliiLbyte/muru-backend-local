import type { NextFunction, Request, Response } from 'express'
import multer, { MulterError } from 'multer'

import { exportCrmCatalog, type CatalogExportFormat } from '../services/crm-catalog-export.service'
import { importCrmCatalogFromBuffer } from '../services/crm-catalog-import.service'
import { CatalogLockedError } from '../services/catalog-source.guard'
import { fail, HttpError, ok } from '../utils/api-response'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const isXlsxFile = (file: Express.Multer.File): boolean => {
  if (file.mimetype === XLSX_MIME) return true
  return file.originalname.toLowerCase().endsWith('.xlsx')
}

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (isXlsxFile(file)) {
      cb(null, true)
      return
    }
    cb(new Error('INVALID_MIME'))
  },
}).single('file')

export const crmCatalogImportMiddleware = (req: Request, res: Response, next: NextFunction) => {
  multerUpload(req, res, (err: unknown) => {
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return fail(res, 413, 'File exceeds 20MB limit', 'VALIDATION')
    }
    if (err instanceof Error && err.message === 'INVALID_MIME') {
      return fail(res, 400, 'Only .xlsx files are allowed', 'VALIDATION')
    }
    if (err) return next(err)
    return next()
  })
}

export const exportCrmCatalogHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawFormat = typeof req.query.format === 'string' ? req.query.format : 'xlsx'
    if (rawFormat !== 'xlsx' && rawFormat !== 'csv') {
      return fail(res, 400, 'Invalid format; use xlsx or csv', 'VALIDATION')
    }
    const format = rawFormat as CatalogExportFormat

    const { buffer, contentType, filename } = await exportCrmCatalog(format)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(buffer)
  } catch (error) {
    return next(error)
  }
}

export const importCrmCatalogHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      return fail(res, 400, 'File is required', 'VALIDATION')
    }

    const dryRun = req.query.dryRun === 'true'
    const result = await importCrmCatalogFromBuffer(req.file.buffer, dryRun)
    return ok(res, result)
  } catch (error) {
    if (error instanceof CatalogLockedError) {
      return fail(res, 423, error.message, 'LOCKED')
    }
    if (error instanceof HttpError) {
      return fail(res, error.status, error.message, error.code)
    }
    return next(error)
  }
}
