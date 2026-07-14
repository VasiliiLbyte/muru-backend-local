/**
 * Canonical top-level catalog sections used by the Mini App home grid and API tree.
 * Sheet/Drive sync maps arbitrary section strings onto one of these names so DB slugs match UI routes.
 */
export const SALE_CATEGORY_NAME = 'Распродажа' as const

export const TOP_LEVEL_CATEGORIES = [
  'Флористика',
  'Натуральный декор',
  'Вазы и аксессуары',
  'Текстиль',
  'Кухня и столовая',
  'Интерьер',
  'Распродажа',
  'Комплексные наборы',
] as const

const MIN_PREFIX_LEN = 4

/**
 * Map a raw spreadsheet section (possibly "Флористика для дома" or "Флористика>…") to a canonical top-level name.
 */
export const mapSheetSectionToTopLevel = (raw: string): string => {
  const first = raw.split(/[>,/|]/)[0]?.trim() || raw.trim()
  if (!first) return 'Без категории'

  const lower = first.toLowerCase()

  for (const name of TOP_LEVEL_CATEGORIES) {
    if (name.toLowerCase() === lower) return name
  }

  const sorted = [...TOP_LEVEL_CATEGORIES].sort((a, b) => b.length - a.length)
  for (const name of sorted) {
    const nl = name.toLowerCase()
    if (lower.startsWith(nl)) return name
  }

  for (const name of sorted) {
    const nl = name.toLowerCase()
    if (lower.length >= MIN_PREFIX_LEN && nl.startsWith(lower)) return name
  }

  return first
}
