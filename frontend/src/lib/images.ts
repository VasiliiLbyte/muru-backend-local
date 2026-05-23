import { getViteApiBaseUrl } from './api-base-url'

const DRIVE_FILE_ID_PATTERNS = [/[?&]id=([^&]+)/i, /\/file\/d\/([^/]+)/i]

const PROXY_WIDTHS = [320, 600, 1200] as const
export type ProxiedImageWidth = (typeof PROXY_WIDTHS)[number]

export const extractDriveFileId = (url: string): string | null => {
  for (const pattern of DRIVE_FILE_ID_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

/** Base URL for /img proxy: same-origin uses relative paths. */
export const getImageProxyBase = (): string => {
  if (typeof window === 'undefined') {
    return getViteApiBaseUrl().replace(/\/+$/, '')
  }

  const apiBase = getViteApiBaseUrl().replace(/\/+$/, '')
  if (!apiBase) return ''

  try {
    const apiOrigin = new URL(apiBase).origin
    if (apiOrigin === window.location.origin) return ''
  } catch {
    return apiBase
  }

  return apiBase
}

export const buildProxiedImageUrl = (
  rawUrl?: string | null,
  width: ProxiedImageWidth = 600,
  format: 'webp' | 'avif' | 'jpeg' = 'webp',
): string | null => {
  if (!rawUrl?.trim()) return null
  const fileId = extractDriveFileId(rawUrl.trim())
  if (!fileId) return null
  const base = getImageProxyBase()
  return `${base}/img/${fileId}/${width}.${format}`
}

export const buildImageSrcSet = (rawUrl?: string | null): string | undefined => {
  if (!rawUrl?.trim()) return undefined
  const fileId = extractDriveFileId(rawUrl.trim())
  if (!fileId) return undefined

  const base = getImageProxyBase()
  return PROXY_WIDTHS.map((w) => `${base}/img/${fileId}/${w}.webp ${w}w`).join(', ')
}

const driveFallbackCandidates = (fileId: string): string[] => [
  `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
  `https://lh3.googleusercontent.com/d/${fileId}=w1600`,
  `https://drive.google.com/uc?export=view&id=${fileId}`,
]

export const buildImageCandidates = (rawUrl?: string | null): string[] => {
  const fallback = 'https://placehold.co/1200x1200?text=MURU'
  if (!rawUrl || !rawUrl.trim()) return [fallback]

  const url = rawUrl.trim()
  const fileId = extractDriveFileId(url)
  if (!fileId) return [url, fallback]

  const proxied = buildProxiedImageUrl(url, 600)
  const candidates: string[] = []
  if (proxied) candidates.push(proxied)
  candidates.push(...driveFallbackCandidates(fileId), fallback)
  return candidates
}
