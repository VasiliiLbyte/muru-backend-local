/** Bitrix CyrillicToLatin table — matches muru.ru URL generation. */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

/**
 * Deterministic latin slug: lowercase → Bitrix translit → non [a-z0-9-] → `-`
 * → collapse dashes → trim edge dashes.
 */
export const slugifyLatin = (input: string): string => {
  const lower = input.toLowerCase().trim()
  let out = ''
  for (const ch of lower) {
    if (Object.prototype.hasOwnProperty.call(CYRILLIC_TO_LATIN, ch)) {
      out += CYRILLIC_TO_LATIN[ch]
      continue
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      out += ch
      continue
    }
    out += '-'
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '')
}

/** First free slug: `base`, then `base-2`, `base-3`, … */
export const allocateUniqueSlug = (base: string, taken: Set<string>): string => {
  const normalized = base || 'item'
  if (!taken.has(normalized)) {
    taken.add(normalized)
    return normalized
  }
  let n = 2
  for (;;) {
    const candidate = `${normalized}-${n}`
    if (!taken.has(candidate)) {
      taken.add(candidate)
      return candidate
    }
    n += 1
  }
}

/**
 * Resolve unique slugs for items ordered by SKU ascending (reproducible collisions).
 */
export const resolveUniqueSlugsBySku = (
  items: Array<{ sku: string; base: string }>,
): Map<string, string> => {
  const sorted = [...items].sort((a, b) => a.sku.localeCompare(b.sku, 'en'))
  const taken = new Set<string>()
  const result = new Map<string, string>()
  for (const item of sorted) {
    result.set(item.sku, allocateUniqueSlug(item.base, taken))
  }
  return result
}
