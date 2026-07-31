import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import sharp from 'sharp'

import type { ContentImage, ContentVideo } from '../types/content'
import { HttpError } from '../utils/api-response'
import { env } from '../utils/env'

export const ALLOWED_VIDEO_UPLOAD_MIMES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const

export const MAX_VIDEO_DURATION_SEC = 30
export const MAX_VIDEO_WIDTH = 1920
const MAX_POSTER_EDGE = 2000
const WEBP_QUALITY = 85

mkdirSync(env.uploadsDir, { recursive: true })

export type ContentVideoUploadResult = {
  video: ContentVideo
  image: ContentImage
}

type ProbeInfo = {
  durationSec: number
  width?: number
  height?: number
  hasAudio: boolean
}

const binaryAvailable = (bin: string): boolean => {
  const result = spawnSync(bin, ['-version'], { encoding: 'utf8' })
  return result.status === 0
}

export const assertFfmpegAvailable = (): void => {
  if (!binaryAvailable('ffmpeg') || !binaryAvailable('ffprobe')) {
    throw new HttpError(
      503,
      'На сервере не установлен ffmpeg. Установите ffmpeg (brew install ffmpeg / apt install ffmpeg) и перезапустите API.',
      'INTERNAL',
    )
  }
}

const runCommand = (bin: string, args: string[]): Promise<{ stdout: Buffer; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      const stderr = Buffer.concat(stderrChunks).toString('utf8')
      if (code !== 0) {
        reject(new Error(`${bin} exited with code ${code}: ${stderr.slice(-800)}`))
        return
      }
      resolve({ stdout: Buffer.concat(stdoutChunks), stderr })
    })
  })

export const probeVideoFile = async (inputPath: string): Promise<ProbeInfo> => {
  const { stdout } = await runCommand('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    inputPath,
  ])

  let parsed: {
    format?: { duration?: string }
    streams?: Array<{ codec_type?: string; width?: number; height?: number }>
  }
  try {
    parsed = JSON.parse(stdout.toString('utf8')) as typeof parsed
  } catch {
    throw new HttpError(400, 'Не удалось прочитать метаданные видео.', 'VALIDATION')
  }

  const durationRaw = Number(parsed.format?.duration ?? NaN)
  if (!Number.isFinite(durationRaw) || durationRaw <= 0) {
    throw new HttpError(400, 'Не удалось определить длительность видео.', 'VALIDATION')
  }

  const videoStream = parsed.streams?.find((s) => s.codec_type === 'video')
  const hasAudio = Boolean(parsed.streams?.some((s) => s.codec_type === 'audio'))

  return {
    durationSec: durationRaw,
    width:
      typeof videoStream?.width === 'number' && videoStream.width > 0
        ? videoStream.width
        : undefined,
    height:
      typeof videoStream?.height === 'number' && videoStream.height > 0
        ? videoStream.height
        : undefined,
    hasAudio,
  }
}

const encodeMp4 = async (
  inputPath: string,
  outputPath: string,
  hasAudio: boolean,
): Promise<void> => {
  const scaleFilter = `scale='min(${MAX_VIDEO_WIDTH},iw)':-2`
  const baseArgs = [
    '-y',
    '-i',
    inputPath,
    '-vf',
    scaleFilter,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
  ]

  const withAudio = [...baseArgs, '-c:a', 'aac', '-b:a', '96k', '-ac', '2', outputPath]
  const withoutAudio = [...baseArgs, '-an', outputPath]

  try {
    await runCommand('ffmpeg', hasAudio ? withAudio : withoutAudio)
  } catch (error) {
    if (!hasAudio) throw error
    // Retry without audio if the stream is broken / unsupported.
    await runCommand('ffmpeg', withoutAudio)
  }
}

const extractPosterFrame = async (
  inputPath: string,
  durationSec: number,
): Promise<Buffer> => {
  const seekSec = durationSec >= 1 ? 1 : Math.max(0, durationSec / 2)
  const { stdout } = await runCommand('ffmpeg', [
    '-y',
    '-ss',
    String(seekSec),
    '-i',
    inputPath,
    '-frames:v',
    '1',
    '-f',
    'image2pipe',
    '-vcodec',
    'png',
    'pipe:1',
  ])

  if (stdout.length === 0) {
    throw new HttpError(400, 'Не удалось извлечь кадр для постера.', 'VALIDATION')
  }

  return stdout
}

const savePosterWebp = async (framePng: Buffer, filename: string): Promise<ContentImage> => {
  const output = await sharp(framePng)
    .rotate()
    .resize({
      width: MAX_POSTER_EDGE,
      height: MAX_POSTER_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  const metadata = await sharp(output).metadata()
  await writeFile(join(env.uploadsDir, filename), output)

  const image: ContentImage = { url: `/uploads/${filename}` }
  if (typeof metadata.width === 'number' && metadata.width > 0) image.width = metadata.width
  if (typeof metadata.height === 'number' && metadata.height > 0) image.height = metadata.height
  return image
}

const mimeToExt = (mime: string): string => {
  if (mime === 'video/webm') return 'webm'
  if (mime === 'video/quicktime') return 'mov'
  return 'mp4'
}

export const assertVideoDurationAllowed = (durationSec: number): void => {
  if (durationSec > MAX_VIDEO_DURATION_SEC) {
    throw new HttpError(
      400,
      'Видео длиннее 30 секунд. Сократите ролик и загрузите снова.',
      'VALIDATION',
    )
  }
}

export const processAndSaveVideoUpload = async (
  buffer: Buffer,
  mime: string,
): Promise<ContentVideoUploadResult> => {
  if (!ALLOWED_VIDEO_UPLOAD_MIMES.includes(mime as (typeof ALLOWED_VIDEO_UPLOAD_MIMES)[number])) {
    throw new HttpError(400, 'Можно загружать только MP4, MOV или WebM.', 'VALIDATION')
  }

  assertFfmpegAvailable()

  const id = randomUUID()
  const tempDir = await mkdtemp(join(tmpdir(), 'muru-video-'))
  const inputPath = join(tempDir, `input.${mimeToExt(mime)}`)
  const mp4Name = `${id}.mp4`
  const webpName = `${id}.webp`
  const outputMp4 = join(env.uploadsDir, mp4Name)

  try {
    await writeFile(inputPath, buffer)
    const probe = await probeVideoFile(inputPath)
    assertVideoDurationAllowed(probe.durationSec)

    await encodeMp4(inputPath, outputMp4, probe.hasAudio)

    let encodedProbe: ProbeInfo
    try {
      encodedProbe = await probeVideoFile(outputMp4)
    } catch {
      encodedProbe = probe
    }

    const frame = await extractPosterFrame(inputPath, probe.durationSec)
    const image = await savePosterWebp(frame, webpName)

    const video: ContentVideo = {
      url: `/uploads/${mp4Name}`,
      mime: 'video/mp4',
      durationSec: Math.round(encodedProbe.durationSec * 10) / 10,
    }
    if (encodedProbe.width) video.width = encodedProbe.width
    if (encodedProbe.height) video.height = encodedProbe.height

    return { video, image }
  } catch (error) {
    await rm(outputMp4, { force: true }).catch(() => undefined)
    await rm(join(env.uploadsDir, webpName), { force: true }).catch(() => undefined)
    if (error instanceof HttpError) throw error
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[content-video-upload]', message)
    throw new HttpError(500, 'Не удалось обработать видео. Проверьте файл и попробуйте снова.', 'INTERNAL')
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
