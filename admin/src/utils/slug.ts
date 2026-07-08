const TRANSLIT_MAP: Record<string, string> = {
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
  х: 'h',
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

export const slugifyTitle = (title: string): string => {
  const lower = title.trim().toLowerCase()
  let result = ''

  for (const char of lower) {
    if (TRANSLIT_MAP[char]) {
      result += TRANSLIT_MAP[char]
    } else if (/[a-z0-9]/.test(char)) {
      result += char
    } else if (/\s|[-_]/.test(char)) {
      result += '-'
    }
  }

  return result
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}
