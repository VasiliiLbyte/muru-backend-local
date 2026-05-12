const DRIVE_FILE_ID_PATTERNS = [/[\?&]id=([^&]+)/i, /\/file\/d\/([^/]+)/i]

const extractDriveFileId = (url: string): string | null => {
  for (const pattern of DRIVE_FILE_ID_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

export const buildImageCandidates = (rawUrl?: string | null): string[] => {
  const fallback = 'https://placehold.co/1200x1200?text=MURU'
  if (!rawUrl || !rawUrl.trim()) return [fallback]

  const url = rawUrl.trim()
  const fileId = extractDriveFileId(url)
  if (!fileId) return [url, fallback]

  return [
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
    `https://lh3.googleusercontent.com/d/${fileId}=w1600`,
    `https://drive.google.com/uc?export=view&id=${fileId}`,
    fallback,
  ]
}
