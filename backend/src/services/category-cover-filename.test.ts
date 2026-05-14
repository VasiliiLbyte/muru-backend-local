import { describe, expect, it } from 'vitest'

import { buildDriveNameToIdMap, resolveFileIdByName, validateCoverDriveFilename } from './category-cover-filename'

describe('validateCoverDriveFilename', () => {
  it('accepts null and empty', () => {
    expect(validateCoverDriveFilename(null)).toEqual({ ok: true, value: null })
    expect(validateCoverDriveFilename('  ')).toEqual({ ok: true, value: null })
  })

  it('rejects path-like input', () => {
    expect(validateCoverDriveFilename('a/b.webp').ok).toBe(false)
    expect(validateCoverDriveFilename('..\\x').ok).toBe(false)
  })

  it('accepts basename', () => {
    expect(validateCoverDriveFilename('  Foo.webp  ')).toEqual({ ok: true, value: 'Foo.webp' })
  })
})

describe('buildDriveNameToIdMap and resolveFileIdByName', () => {
  it('resolves case-insensitive', () => {
    const { map } = buildDriveNameToIdMap([
      { id: '1', name: 'A.webp' },
      { id: '2', name: 'B.png' },
    ])
    expect(resolveFileIdByName(map, 'a.webp')).toBe('1')
    expect(resolveFileIdByName(map, 'B.PNG')).toBe('2')
  })

  it('records duplicate warning', () => {
    const { map, warnings } = buildDriveNameToIdMap([
      { id: '1', name: 'dup.webp' },
      { id: '2', name: 'Dup.webp' },
    ])
    expect(map.get('dup.webp')).toBe('1')
    expect(warnings.length).toBeGreaterThan(0)
  })
})
