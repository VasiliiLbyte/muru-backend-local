import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockWriteFile,
  mockMkdirSync,
  mockSharp,
  mockToBuffer,
  mockMetadata,
  mockRotate,
  mockResize,
  mockWebp,
} = vi.hoisted(() => ({
  mockWriteFile: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockSharp: vi.fn(),
  mockToBuffer: vi.fn(),
  mockMetadata: vi.fn(),
  mockRotate: vi.fn(),
  mockResize: vi.fn(),
  mockWebp: vi.fn(),
}))

vi.mock('node:fs', () => ({
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}))

vi.mock('node:fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('node:crypto', () => ({
  randomUUID: () => 'test-uuid-1234',
}))

vi.mock('sharp', () => ({
  default: (...args: unknown[]) => mockSharp(...args),
}))

vi.mock('../utils/env', () => ({
  env: {
    uploadsDir: '/tmp/muru-uploads-test',
  },
}))

import { processAndSaveUpload } from './content-upload.service'
import { HttpError } from '../utils/api-response'

describe('content-upload.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockToBuffer.mockResolvedValue(Buffer.from('webp-output'))
    mockMetadata.mockResolvedValue({ width: 1200, height: 800 })
    mockWebp.mockReturnValue({ toBuffer: mockToBuffer })
    mockResize.mockReturnValue({ webp: mockWebp })
    mockRotate.mockReturnValue({ resize: mockResize })
    mockSharp.mockImplementation((input?: unknown) => {
      if (
        input !== undefined &&
        Buffer.isBuffer(input) &&
        input.equals(Buffer.from('webp-output'))
      ) {
        return { metadata: mockMetadata }
      }
      return { rotate: mockRotate }
    })
    mockWriteFile.mockResolvedValue(undefined)
  })

  it('rejects non-image mime types', async () => {
    await expect(processAndSaveUpload(Buffer.from('plain'), 'text/plain')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
    })
    expect(mockSharp).not.toHaveBeenCalled()
  })

  it('processes jpeg and returns ContentImage dto', async () => {
    const result = await processAndSaveUpload(Buffer.from('jpeg-bytes'), 'image/jpeg')

    expect(mockRotate).toHaveBeenCalled()
    expect(mockResize).toHaveBeenCalledWith({
      width: 2000,
      height: 2000,
      fit: 'inside',
      withoutEnlargement: true,
    })
    expect(mockWebp).toHaveBeenCalledWith({ quality: 85 })
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/muru-uploads-test/test-uuid-1234.webp',
      Buffer.from('webp-output'),
    )
    expect(result).toEqual({
      url: '/uploads/test-uuid-1234.webp',
      width: 1200,
      height: 800,
    })
  })

  it('throws HttpError for invalid mime', async () => {
    await expect(processAndSaveUpload(Buffer.from('x'), 'application/pdf')).rejects.toBeInstanceOf(
      HttpError,
    )
  })
})
