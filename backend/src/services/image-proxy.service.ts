import { createReadStream } from 'node:fs'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import sharp from 'sharp'

import type { ImageFormat, ImageWidth } from '../utils/drive-file-id'
import { imageMimeType } from '../utils/drive-file-id'
import { env } from '../utils/env'

import { createMuruDriveClient } from './google-drive-muru-folder'

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

const inflight = new Map<string, Promise<unknown>>()

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

const fileDir = (fileId: string) => join(env.imageCacheDir, fileId)

const variantPath = (fileId: string, width: ImageWidth, format: ImageFormat) =>
  join(fileDir(fileId), `${width}.${format}`)

const originalPath = (fileId: string) => join(fileDir(fileId), 'original')

const crmUploadMarkerPath = (fileId: string) => join(fileDir(fileId), '.crm-upload')

const isCrmFileId = (fileId: string) => fileId.startsWith('crm_')

const placeholderPath = (fileId: string) => join(fileDir(fileId), 'placeholder.json')

const runDeduped = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const existing = inflight.get(key) as Promise<T> | undefined
  if (existing) return existing

  const promise = fn()
  inflight.set(key, promise)
  try {
    return await promise
  } finally {
    inflight.delete(key)
  }
}

const writeLqipPlaceholder = async (fileId: string, source: Buffer): Promise<void> => {
  const lqipBuf = await sharp(source)
    .resize(16, 16, { fit: 'cover' })
    .blur(2)
    .webp({ quality: 30 })
    .toBuffer()

  const b64 = `data:image/webp;base64,${lqipBuf.toString('base64')}`
  await writeFile(placeholderPath(fileId), JSON.stringify({ b64 }), 'utf8')
}

const crmCacheNotFoundError = (message: string) => {
  const err = new Error(message) as Error & { code?: number }
  err.code = 404
  return err
}

export const saveCrmCachedOriginal = async (fileId: string, buffer: Buffer): Promise<void> => {
  await mkdir(fileDir(fileId), { recursive: true })
  await writeFile(originalPath(fileId), buffer)
  await writeFile(crmUploadMarkerPath(fileId), '', 'utf8')
  try {
    await writeLqipPlaceholder(fileId, buffer)
  } catch (error) {
    console.error(`[image-proxy] LQIP generation failed for ${fileId}`, error)
  }
}

const downloadOriginal = async (fileId: string): Promise<Buffer> =>
  runDeduped(`original:${fileId}`, async () => {
    const cached = originalPath(fileId)
    if (await fileExists(cached)) {
      return readFile(cached)
    }

    if (await fileExists(crmUploadMarkerPath(fileId))) {
      throw crmCacheNotFoundError('CRM upload cache missing')
    }

    if (isCrmFileId(fileId)) {
      throw crmCacheNotFoundError('CRM image not found in cache')
    }

    const drive = createMuruDriveClient()
    const response = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' },
    )

    const buffer = await streamToBuffer(response.data as Readable)
    await mkdir(fileDir(fileId), { recursive: true })
    await writeFile(cached, buffer)

    try {
      await writeLqipPlaceholder(fileId, buffer)
    } catch (error) {
      console.error(`[image-proxy] LQIP generation failed for ${fileId}`, error)
    }

    return buffer
  })

const encodeVariant = async (
  source: Buffer,
  width: ImageWidth,
  format: ImageFormat,
): Promise<Buffer> => {
  let pipeline = sharp(source).resize({
    width,
    fit: 'inside',
    withoutEnlargement: true,
  })

  switch (format) {
    case 'webp':
      pipeline = pipeline.webp({ quality: 82 })
      break
    case 'avif':
      pipeline = pipeline.avif({ quality: 65 })
      break
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true })
      break
    default:
      break
  }

  return pipeline.toBuffer()
}

const ensureVariantFile = async (
  fileId: string,
  width: ImageWidth,
  format: ImageFormat,
): Promise<string> => {
  const target = variantPath(fileId, width, format)
  if (await fileExists(target)) return target

  return runDeduped(`variant:${fileId}:${width}:${format}`, async () => {
    if (await fileExists(target)) return target

    const original = await downloadOriginal(fileId)
    const encoded = await encodeVariant(original, width, format)
    await mkdir(fileDir(fileId), { recursive: true })
    await writeFile(target, encoded)
    return target
  })
}

export type ServeImageResult = {
  stream: Readable
  mimeType: string
  cacheControl: string
}

export const serveImage = async (
  fileId: string,
  width: ImageWidth,
  format: ImageFormat,
): Promise<ServeImageResult> => {
  const path = await ensureVariantFile(fileId, width, format)
  return {
    stream: createReadStream(path),
    mimeType: imageMimeType(format),
    cacheControl: CACHE_CONTROL,
  }
}

export type LqipResponse = { b64: string | null }

export const getLqip = async (fileId: string): Promise<LqipResponse> => {
  const path = placeholderPath(fileId)
  if (!(await fileExists(path))) {
    return { b64: null }
  }

  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as { b64?: unknown }
    return { b64: typeof parsed.b64 === 'string' ? parsed.b64 : null }
  } catch {
    return { b64: null }
  }
}

export const invalidateImageCache = async (fileIds: string[]): Promise<void> => {
  const unique = [...new Set(fileIds.filter(Boolean))]
  await Promise.all(
    unique.map(async (fileId) => {
      try {
        await rm(fileDir(fileId), { recursive: true, force: true })
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'ENOENT') throw error
      }
    }),
  )
}

/** Drain stream helper for tests / future use */
export const pipeImageToResponse = async (
  result: ServeImageResult,
  writable: NodeJS.WritableStream,
): Promise<void> => {
  await pipeline(result.stream, writable)
}
