const DRIVE_FILE_ID_PATTERNS = [/[?&]id=([^&]+)/i, /\/file\/d\/([^/]+)/i]

export const extractDriveFileId = (url: string): string | null => {
  for (const pattern of DRIVE_FILE_ID_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

export const buildProxiedImageUrl = (
  rawUrl: string,
  width = 600,
  format: 'webp' | 'avif' | 'jpeg' = 'webp',
): string | null => {
  const fileId = extractDriveFileId(rawUrl.trim())
  if (!fileId) return null
  return `/img/${fileId}/${width}.${format}`
}
