import type { NextFunction, Request, Response } from 'express'
import multer, { MulterError } from 'multer'

import {
  ALLOWED_VIDEO_UPLOAD_MIMES,
  processAndSaveVideoUpload,
} from '../services/content-video-upload.service'
import { fail, ok } from '../utils/api-response'

export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_VIDEO_UPLOAD_MIMES.includes(file.mimetype as (typeof ALLOWED_VIDEO_UPLOAD_MIMES)[number])) {
      cb(null, true)
      return
    }
    cb(new Error('INVALID_MIME'))
  },
}).single('file')

export const uploadVideoMiddleware = (req: Request, res: Response, next: NextFunction) => {
  multerUpload(req, res, (err: unknown) => {
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return fail(
        res,
        413,
        'Файл больше 50 МБ. Сожмите видео или уменьшите разрешение.',
        'VALIDATION',
      )
    }
    if (err instanceof Error && err.message === 'INVALID_MIME') {
      return fail(res, 400, 'Можно загружать только MP4, MOV или WebM.', 'VALIDATION')
    }
    if (err) return next(err)
    return next()
  })
}

export const uploadVideoHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return fail(res, 400, 'Выберите видеофайл.', 'VALIDATION')
    }

    const result = await processAndSaveVideoUpload(req.file.buffer, req.file.mimetype)
    return ok(res, result)
  } catch (error) {
    return next(error)
  }
}
