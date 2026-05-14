/** Shared base URL for fetch (auth + api). Vite inlines env at build time. */
export const normalizeApiBaseUrl = (raw: unknown): string => {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return 'http://localhost:4000'
  const noTrailingSlash = s.replace(/\/+$/, '')
  const withScheme = /^https?:\/\//i.test(noTrailingSlash) ? noTrailingSlash : `https://${noTrailingSlash}`
  try {
    new URL(withScheme)
    return withScheme
  } catch {
    return 'http://localhost:4000'
  }
}

export const getViteApiBaseUrl = (): string =>
  normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
