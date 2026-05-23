import { describe, expect, it } from 'vitest'

import {
  extractDriveFileId,
  isValidDriveFileId,
  parseImageVariant,
  parseImageWidth,
} from './drive-file-id'

describe('extractDriveFileId', () => {
  it('parses thumbnail and file URLs', () => {
    expect(extractDriveFileId('https://drive.google.com/thumbnail?id=abc123_X&sz=w1600')).toBe(
      'abc123_X',
    )
    expect(extractDriveFileId('https://drive.google.com/file/d/xyz-9/view')).toBe('xyz-9')
  })

  it('returns null for non-drive URLs', () => {
    expect(extractDriveFileId('https://example.com/img.png')).toBeNull()
  })
})

describe('isValidDriveFileId', () => {
  it('accepts alphanumeric id with _ and -', () => {
    expect(isValidDriveFileId('abc_123-XY')).toBe(true)
    expect(isValidDriveFileId('../etc')).toBe(false)
  })
})

describe('parseImageVariant', () => {
  it('accepts allowed width and format', () => {
    expect(parseImageVariant('600', 'webp')).toEqual({ width: 600, format: 'webp' })
  })

  it('rejects invalid values', () => {
    expect(parseImageWidth('500')).toBeNull()
    expect(parseImageVariant('600', 'png')).toBeNull()
  })
})
