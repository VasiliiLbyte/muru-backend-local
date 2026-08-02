import { pool } from '../utils/db'

/** Last-resort path when site_settings.catalog_placeholder_image_url is empty. */
export const FALLBACK_CATALOG_PLACEHOLDER = '/uploads/catalog-placeholder.webp'

/** Legacy hardcoded URL written by older CRM create / sync. */
export const LEGACY_PLACEHOLD_CO = 'https://placehold.co/1200x1200?text=MURU'

export const isGenericPlaceholderUrl = (url: string | null | undefined): boolean => {
  const trimmed = (url ?? '').trim()
  if (!trimmed) return true
  if (trimmed === LEGACY_PLACEHOLD_CO) return true
  if (trimmed.toLowerCase().includes('placehold.co')) return true
  return false
}

export const applyPlaceholderToImageUrls = (
  urls: string[],
  placeholder: string,
): string[] => {
  const cleaned = urls.map((u) => u.trim()).filter(Boolean)
  if (cleaned.length === 0) return [placeholder]
  if (cleaned.every(isGenericPlaceholderUrl)) return [placeholder]
  if (isGenericPlaceholderUrl(cleaned[0])) return [placeholder]
  return cleaned.filter((u) => !isGenericPlaceholderUrl(u))
}

/**
 * Resolve the brand catalog placeholder URL from site_settings (light SELECT).
 * Falls back to FALLBACK_CATALOG_PLACEHOLDER when unset.
 */
export const getCatalogPlaceholderImageUrl = async (): Promise<string> => {
  const result = await pool.query<{ catalog_placeholder_image_url: string | null }>(
    `SELECT catalog_placeholder_image_url FROM site_settings WHERE id = 1`,
  )
  const fromDb = result.rows[0]?.catalog_placeholder_image_url?.trim()
  if (fromDb) return fromDb
  return FALLBACK_CATALOG_PLACEHOLDER
}
