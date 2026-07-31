import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import { HttpError } from '../utils/api-response'
import {
  assertFfmpegAvailable,
  assertVideoDurationAllowed,
  processAndSaveVideoUpload,
} from './content-video-upload.service'

const hasFfmpeg =
  spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0 &&
  spawnSync('ffprobe', ['-version'], { encoding: 'utf8' }).status === 0

describe('content-video-upload.service', () => {
  it('rejects non-video mime without calling ffmpeg encode', async () => {
    await expect(processAndSaveVideoUpload(Buffer.from('x'), 'image/jpeg')).rejects.toMatchObject({
      status: 400,
      message: 'Можно загружать только MP4, MOV или WebM.',
    })
  })

  it('assertVideoDurationAllowed rejects over 30 seconds', () => {
    expect(() => assertVideoDurationAllowed(30)).not.toThrow()
    expect(() => assertVideoDurationAllowed(30.1)).toThrow(HttpError)
    try {
      assertVideoDurationAllowed(45)
    } catch (err) {
      expect(err).toMatchObject({
        status: 400,
        message: expect.stringContaining('30'),
      })
    }
  })

  it('assertFfmpegAvailable reflects binaries on PATH', () => {
    if (hasFfmpeg) {
      expect(() => assertFfmpegAvailable()).not.toThrow()
    } else {
      expect(() => assertFfmpegAvailable()).toThrow(HttpError)
      try {
        assertFfmpegAvailable()
      } catch (err) {
        expect(err).toMatchObject({
          status: 503,
          message: expect.stringContaining('ffmpeg'),
        })
      }
    }
  })

  it.skipIf(!hasFfmpeg)(
    'encodes a tiny generated mp4 when ffmpeg is available',
    async () => {
      // Minimal synthetic clip via ffmpeg lavfi (requires real binaries).
      const { spawnSync: sync } = await import('node:child_process')
      const { mkdtemp, readFile, rm } = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')

      const dir = await mkdtemp(join(tmpdir(), 'muru-vtest-'))
      const sample = join(dir, 'sample.mp4')
      const gen = sync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'color=c=black:s=320x240:d=1',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          sample,
        ],
        { encoding: 'utf8' },
      )
      expect(gen.status).toBe(0)

      const buffer = await readFile(sample)
      const result = await processAndSaveVideoUpload(buffer, 'video/mp4')
      expect(result.video.url).toMatch(/^\/uploads\/.+\.mp4$/)
      expect(result.image.url).toMatch(/^\/uploads\/.+\.webp$/)
      expect(result.video.mime).toBe('video/mp4')

      await rm(dir, { recursive: true, force: true })
    },
    60_000,
  )
})
