export const IMAGE_WIDTHS = [320, 600, 1200] as const
export const IMAGE_FORMATS = ['webp', 'avif', 'jpeg'] as const

export type ImageWidth = (typeof IMAGE_WIDTHS)[number]
export type ImageFormat = (typeof IMAGE_FORMATS)[number]

const DRIVE_FILE_ID_PATTERNS = [/[?&]id=([^&]+)/i, /\/file\/d\/([^/]+)/i]
const DRIVE_FILE_ID_RE = /^[a-zA-Z0-9_-]+$/

export const extractDriveFileId = (url: string): string | null => {
  for (const pattern of DRIVE_FILE_ID_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

export const isValidDriveFileId = (fileId: string): boolean => DRIVE_FILE_ID_RE.test(fileId)

export const parseImageWidth = (raw: string): ImageWidth | null => {
  const parsed = Number(raw)
  if (parsed === 320 || parsed === 600 || parsed === 1200) return parsed
  return null
}

export const parseImageFormat = (raw: string): ImageFormat | null => {
  if (raw === 'webp' || raw === 'avif' || raw === 'jpeg') return raw
  return null
}

export const parseImageVariant = (
  widthRaw: string,
  formatRaw: string,
): { width: ImageWidth; format: ImageFormat } | null => {
  const width = parseImageWidth(widthRaw)
  const format = parseImageFormat(formatRaw)
  if (!width || !format) return null
  return { width, format }
}

export const imageMimeType = (format: ImageFormat): string => {
  switch (format) {
    case 'webp':
      return 'image/webp'
    case 'avif':
      return 'image/avif'
    case 'jpeg':
      return 'image/jpeg'
    default:
      return 'application/octet-stream'
  }
}
