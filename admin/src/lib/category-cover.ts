import { buildProxiedImageUrl } from './images'

/** Preview src for category/subcategory covers (Drive → /img/ proxy). */
export const categoryCoverPreviewSrc = (url: string | null | undefined): string | null => {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  const proxied = buildProxiedImageUrl(trimmed)
  if (proxied) return proxied
  if (trimmed.startsWith('/img/') || trimmed.startsWith('/uploads/')) return trimmed
  return trimmed
}

export const SALE_CATEGORY_NAME = 'Распродажа'
