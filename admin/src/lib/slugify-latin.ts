/** Bitrix CyrillicToLatin — keep in sync with backend slug-translit.ts */
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
