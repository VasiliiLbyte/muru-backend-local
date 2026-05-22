import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearDriveFilenameIndexCache,
  DRIVE_FILENAME_INDEX_TTL_MS,
  getCachedDriveFilenameIndex,
  isDriveFilenameIndexFresh,
  setDriveFilenameIndexFromFiles,
} from './drive-filename-index-cache'

afterEach(() => {
  clearDriveFilenameIndexCache()
  vi.useRealTimers()
})

describe('drive-filename-index-cache', () => {
  it('returns null when empty', () => {
    expect(getCachedDriveFilenameIndex()).toBeNull()
    expect(isDriveFilenameIndexFresh()).toBe(false)
  })

  it('stores lowercase keys', () => {
    setDriveFilenameIndexFromFiles([
      { id: 'id1', name: 'Foo.webp' },
      { id: 'id2', name: 'BAR.png' },
    ])
    const map = getCachedDriveFilenameIndex()
    expect(map?.get('foo.webp')).toBe('id1')
    expect(map?.get('bar.png')).toBe('id2')
    expect(isDriveFilenameIndexFresh()).toBe(true)
  })

  it('expires after TTL', () => {
    vi.useFakeTimers()
    setDriveFilenameIndexFromFiles([{ id: 'x', name: 'a.webp' }])
    vi.advanceTimersByTime(DRIVE_FILENAME_INDEX_TTL_MS + 1)
    expect(isDriveFilenameIndexFresh()).toBe(false)
    expect(getCachedDriveFilenameIndex()).toBeNull()
  })
})
