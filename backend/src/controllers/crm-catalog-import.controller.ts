import type { NextFunction, Request, Response } from 'express'
import multer, { MulterError } from 'multer'

import { exportCrmCatalog, type CatalogExportFormat } from '../services/crm-catalog-export.service'
import { importCrmCatalogFromBuffer } from '../services/crm-catalog-import.service'
import { getCrmCatalogProductImportTemplate } from '../services/crm-catalog-import-template.service'
import { importCrmCatalogProductsFromBuffer } from '../services/crm-catalog-product-import.service'
import {
  getCatalogProductImportLogById,
  listCatalogProductImportLogs,
  type ProductImportMode,
} from '../services/crm-catalog-product-import-log.service'
import { CatalogLockedError } from '../services/catalog-source.guard'
import type { CrmRequest } from '../middleware/require-crm-auth.middleware'
import { pool } from '../utils/db'
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
      return fail(res, 413, 'Файл больше 20 МБ.', 'VALIDATION')
    }
    if (err instanceof Error && err.message === 'INVALID_MIME') {
      return fail(res, 400, 'Можно загружать только файлы .xlsx.', 'VALIDATION')
    }
    if (err) return next(err)
    return next()
  })
}

const resolveImportActor = async (
  req: Request,
): Promise<{ adminId: number | null; adminEmail: string | null }> => {
  const adminId = (req as CrmRequest).crmAdmin?.adminId ?? null
  if (adminId == null) return { adminId: null, adminEmail: null }
  const r = await pool.query<{ email: string }>(`SELECT email FROM admin_users WHERE id = $1`, [
    adminId,
  ])
  return { adminId, adminEmail: r.rows[0]?.email ?? null }
}

const parseImportMode = (raw: unknown): ProductImportMode | null => {
  if (raw === 'new' || raw === 'upsert') return raw
  return null
}

export const exportCrmCatalogHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawFormat = typeof req.query.format === 'string' ? req.query.format : 'xlsx'
    if (rawFormat !== 'xlsx' && rawFormat !== 'csv') {
      return fail(res, 400, 'Неверный формат. Используйте xlsx или csv.', 'VALIDATION')
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

export const getCrmCatalogImportTemplateHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { buffer, contentType, filename } = getCrmCatalogProductImportTemplate()
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(buffer)
  } catch (error) {
    return next(error)
  }
}

export const importCrmCatalogProductsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      return fail(res, 400, 'Выберите файл.', 'VALIDATION')
    }
    const mode = parseImportMode(req.query.mode)
    if (!mode) {
      return fail(res, 400, 'Укажите mode=new или mode=upsert.', 'VALIDATION')
    }
    const dryRun = req.query.dryRun === 'true'
    const actor = await resolveImportActor(req)
    const result = await importCrmCatalogProductsFromBuffer(req.file.buffer, {
      dryRun,
      mode,
      filename: req.file.originalname || 'upload.xlsx',
      actor,
    })
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

export const listCrmCatalogProductImportLogsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const items = await listCatalogProductImportLogs()
    return ok(res, { items })
  } catch (error) {
    return next(error)
  }
}

export const getCrmCatalogProductImportLogByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      return fail(res, 400, 'Некорректный id импорта.', 'VALIDATION')
    }
    const detail = await getCatalogProductImportLogById(id)
    if (!detail) {
      return fail(res, 404, 'Прогон импорта не найден.', 'NOT_FOUND')
    }
    return ok(res, detail)
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
      return fail(res, 400, 'Выберите файл.', 'VALIDATION')
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
