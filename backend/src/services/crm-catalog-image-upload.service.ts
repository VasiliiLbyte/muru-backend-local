import { randomBytes } from 'node:crypto'

import sharp from 'sharp'

import { HttpError } from '../utils/api-response'

import { assertCatalogCrmWritable } from './catalog-source.guard'
import { ALLOWED_UPLOAD_MIMES } from './content-upload.service'
import { buildDriveThumbnailUrl } from './google-drive-muru-folder'
import { saveCrmCachedOriginal } from './image-proxy.service'

const MAX_LONG_EDGE = 2000

export type CrmCatalogImageUploadResult = {
  url: string
  fileId: string
  proxyPath: string
}

export const uploadCrmCatalogImage = async (
  buffer: Buffer,
  mime: string,
): Promise<CrmCatalogImageUploadResult> => {
  assertCatalogCrmWritable()

  if (!ALLOWED_UPLOAD_MIMES.includes(mime as (typeof ALLOWED_UPLOAD_MIMES)[number])) {
    throw new HttpError(400, 'Only JPEG, PNG, and WebP images are allowed', 'VALIDATION')
  }

  const processed = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_LONG_EDGE,
      height: MAX_LONG_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer()

  const fileId = `crm_${randomBytes(14).toString('hex')}`
  await saveCrmCachedOriginal(fileId, processed)

  return {
    url: buildDriveThumbnailUrl(fileId),
    fileId,
    proxyPath: `/img/${fileId}/1200.webp`,
  }
}
