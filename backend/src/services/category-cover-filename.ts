const MAX_LEN = 255

export type CoverFilenameValidation =
  | { ok: true; value: string | null }
  | { ok: false; message: string }

export function validateCoverDriveFilename(raw: string | null | undefined): CoverFilenameValidation {
  if (raw == null) return { ok: true, value: null }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  if (trimmed.length > MAX_LEN) {
    return { ok: false, message: `Filename must be at most ${MAX_LEN} characters` }
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    return { ok: false, message: 'Path segments (/, \\, ..) are not allowed' }
  }
  return { ok: true, value: trimmed }
}

export type DriveFileEntry = { id: string; name: string }

/**
 * Build map lowercased basename -> fileId. Duplicate names in Drive: keep first, collect warnings.
 */
export function buildDriveNameToIdMap(
  files: DriveFileEntry[],
): { map: Map<string, string>; warnings: string[] } {
  const map = new Map<string, string>()
  const warnings: string[] = []
  for (const file of files) {
    const key = file.name.toLowerCase()
    if (map.has(key)) {
      warnings.push(`Duplicate Drive file name (case-insensitive): ${file.name} — using first match.`)
      continue
    }
    map.set(key, file.id)
  }
  return { map, warnings }
}

export function resolveFileIdByName(
  nameToId: Map<string, string>,
  filename: string,
): string | null {
  const key = filename.toLowerCase()
  return nameToId.get(key) ?? null
}
