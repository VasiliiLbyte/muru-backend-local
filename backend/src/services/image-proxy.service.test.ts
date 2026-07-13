import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFilesGet = vi.fn()
const mockCreateMuruDriveClient = vi.fn(() => ({
  files: { get: mockFilesGet },
}))

const fileState = new Map<string, { original?: Buffer; marker?: boolean; placeholder?: string }>()

vi.mock('node:fs/promises', () => ({
  access: vi.fn(async (path: string) => {
    const key = String(path)
    if (key.endsWith('/original') && fileState.has(extractFileId(key))) {
      const state = fileState.get(extractFileId(key))!
      if (state.original) return
    }
    if (key.endsWith('/.crm-upload') && fileState.has(extractFileId(key))) {
      const state = fileState.get(extractFileId(key))!
      if (state.marker) return
    }
    if (key.endsWith('/placeholder.json') && fileState.has(extractFileId(key))) {
      const state = fileState.get(extractFileId(key))!
      if (state.placeholder) return
    }
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
  }),
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async (path: string) => {
    const key = String(path)
    const fileId = extractFileId(key)
    const state = fileState.get(fileId)
    if (key.endsWith('/original') && state?.original) return state.original
    if (key.endsWith('/placeholder.json') && state?.placeholder) {
      return state.placeholder
    }
    throw new Error('read fail')
  }),
  writeFile: vi.fn(async (path: string, data: string | Buffer) => {
    const key = String(path)
    const fileId = extractFileId(key)
    if (!fileState.has(fileId)) fileState.set(fileId, {})
    const state = fileState.get(fileId)!
    if (key.endsWith('/original')) state.original = Buffer.isBuffer(data) ? data : Buffer.from(data)
    if (key.endsWith('/.crm-upload')) state.marker = true
    if (key.endsWith('/placeholder.json')) state.placeholder = String(data)
  }),
  rm: vi.fn(async () => undefined),
}))

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(() => {
    const { Readable } = require('node:stream')
    return Readable.from([Buffer.from('webp-bytes')])
  }),
}))

vi.mock('./google-drive-muru-folder', () => ({
  createMuruDriveClient: (...args: unknown[]) => mockCreateMuruDriveClient(...args),
}))

vi.mock('../utils/env', () => ({
  env: { imageCacheDir: '/tmp/muru-image-cache' },
}))

const extractFileId = (path: string): string => {
  const parts = path.split('/')
  const originalIdx = parts.indexOf('original')
  const markerIdx = parts.indexOf('.crm-upload')
  const placeholderIdx = parts.indexOf('placeholder.json')
  const idx = originalIdx >= 0 ? originalIdx : markerIdx >= 0 ? markerIdx : placeholderIdx
  return idx > 0 ? parts[idx - 1] : ''
}

import { saveCrmCachedOriginal, serveImage } from './image-proxy.service'

describe('image-proxy.service CRM bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fileState.clear()
  })

  it('serveImage for crm_ id without cache does not call Drive', async () => {
    await expect(serveImage('crm_deadbeef', 1200, 'webp')).rejects.toMatchObject({ code: 404 })
    expect(mockCreateMuruDriveClient).not.toHaveBeenCalled()
    expect(mockFilesGet).not.toHaveBeenCalled()
  })

  it('serveImage works after saveCrmCachedOriginal', async () => {
    const fileId = 'crm_abc123def4567890123456789012'
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    await saveCrmCachedOriginal(fileId, png)

    const result = await serveImage(fileId, 1200, 'webp')
    expect(result.mimeType).toBe('image/webp')
    expect(mockCreateMuruDriveClient).not.toHaveBeenCalled()
  })
})
