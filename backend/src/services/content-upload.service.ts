import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import sharp from 'sharp'

import type { ContentImage } from '../types/content'
import { HttpError } from '../utils/api-response'
import { env } from '../utils/env'

export const ALLOWED_UPLOAD_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const

const MAX_LONG_EDGE = 2000
const WEBP_QUALITY = 85

mkdirSync(env.uploadsDir, { recursive: true })

export const processAndSaveUpload = async (buffer: Buffer, mime: string): Promise<ContentImage> => {
  if (!ALLOWED_UPLOAD_MIMES.includes(mime as (typeof ALLOWED_UPLOAD_MIMES)[number])) {
    throw new HttpError(400, 'Only JPEG, PNG, and WebP images are allowed', 'VALIDATION')
  }

  const pipeline = sharp(buffer)
    .rotate()
    .resize({
      width: MAX_LONG_EDGE,
      height: MAX_LONG_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })

  const output = await pipeline.toBuffer()
  const metadata = await sharp(output).metadata()

  const filename = `${randomUUID()}.webp`
  await writeFile(join(env.uploadsDir, filename), output)

  const image: ContentImage = {
    url: `/uploads/${filename}`,
  }

  if (typeof metadata.width === 'number' && metadata.width > 0) {
    image.width = metadata.width
  }
  if (typeof metadata.height === 'number' && metadata.height > 0) {
    image.height = metadata.height
  }

  return image
}
