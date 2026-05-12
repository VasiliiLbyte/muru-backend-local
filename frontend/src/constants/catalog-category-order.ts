/** Display order for catalog root tiles (must match backend TOP_LEVEL_CATEGORIES). */
export const CATALOG_CATEGORY_ORDER = [
  'Флористика',
  'Натуральный декор',
  'Вазы и аксессуары',
  'Текстиль',
  'Кухня и столовая',
  'Интерьер',
  'Распродажа',
  'Комплексные наборы',
] as const

export const sortCatalogNodes = <T extends { name: string }>(nodes: T[]): T[] => {
  const orderIndex = (name: string) => {
    const idx = (CATALOG_CATEGORY_ORDER as readonly string[]).indexOf(name)
    return idx === -1 ? CATALOG_CATEGORY_ORDER.length : idx
  }
  return [...nodes].sort((a, b) => orderIndex(a.name) - orderIndex(b.name))
}
