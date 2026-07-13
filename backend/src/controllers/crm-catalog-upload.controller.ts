import type { NextFunction, Request, Response } from 'express'
import multer, { MulterError } from 'multer'

import { CatalogLockedError } from '../services/catalog-source.guard'
import { uploadCrmCatalogImage } from '../services/crm-catalog-image-upload.service'
import { ALLOWED_UPLOAD_MIMES } from '../services/content-upload.service'
import { fail, ok } from '../utils/api-response'

const MAX_FILE_SIZE = 10 * 1024 * 1024

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_UPLOAD_MIMES.includes(file.mimetype as (typeof ALLOWED_UPLOAD_MIMES)[number])) {
      cb(null, true)
      return
    }
    cb(new Error('INVALID_MIME'))
  },
}).single('file')

export const crmCatalogUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  multerUpload(req, res, (err: unknown) => {
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return fail(res, 413, 'File exceeds 10MB limit', 'VALIDATION')
    }
    if (err instanceof Error && err.message === 'INVALID_MIME') {
      return fail(res, 400, 'Only JPEG, PNG, and WebP images are allowed', 'VALIDATION')
    }
    if (err) return next(err)
    return next()
  })
}

export const uploadCrmCatalogImageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      return fail(res, 400, 'File is required', 'VALIDATION')
    }

    const result = await uploadCrmCatalogImage(req.file.buffer, req.file.mimetype)
    return ok(res, result)
  } catch (error) {
    if (error instanceof CatalogLockedError) {
      return fail(res, 423, error.message, 'LOCKED')
    }
    return next(error)
  }
}
