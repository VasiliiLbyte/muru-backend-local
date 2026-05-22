/** In-memory index: lowercase Drive filename -> fileId (reused by catalog and category cover sync). */

export const DRIVE_FILENAME_INDEX_TTL_MS = 45 * 60 * 1000

let index: Map<string, string> | null = null
let builtAt = 0

export const isDriveFilenameIndexFresh = (): boolean => {
  if (!index) return false
  return Date.now() - builtAt < DRIVE_FILENAME_INDEX_TTL_MS
}

export const getCachedDriveFilenameIndex = (): Map<string, string> | null => {
  if (!isDriveFilenameIndexFresh() || !index) return null
  return new Map(index)
}

export const setDriveFilenameIndexFromFiles = (files: Array<{ id: string; name: string }>) => {
  const next = new Map<string, string>()
  for (const file of files) {
    const key = file.name.toLowerCase()
    if (!next.has(key)) {
      next.set(key, file.id)
    }
  }
  index = next
  builtAt = Date.now()
}

/** For tests */
export const clearDriveFilenameIndexCache = () => {
  index = null
  builtAt = 0
}
