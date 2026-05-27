/**
 * Parses size strings from the product registry ("11,8×10,3", "30×40×50", "140×220", "17.5")
 * into L×W×H dimensions in centimeters.
 */
export type ParsedDimensions = {
  lengthCm: number
  widthCm: number
  heightCm: number
}

const MIN_CM = 1
const MAX_CM = 150

export const parseDimensionsLabel = (raw: string | undefined): ParsedDimensions | null => {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const normalized = trimmed
    .replace(/[×Xх]/g, 'x')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')

  const numbers = (normalized.match(/[0-9]+(?:\.[0-9]+)?/g) ?? [])
    .map((n) => parseFloat(n))
    .filter((n) => Number.isFinite(n) && n > 0)

  if (numbers.length === 0) return null

  const round = (n: number) => Math.max(MIN_CM, Math.min(MAX_CM, Math.round(n)))

  if (numbers.length === 1) {
    const v = round(numbers[0])
    return { lengthCm: v, widthCm: v, heightCm: v }
  }
  if (numbers.length === 2) {
    const a = round(numbers[0])
    const b = round(numbers[1])
    if (a >= 80 && b >= 80) {
      return { lengthCm: a, widthCm: b, heightCm: 2 }
    }
    return { lengthCm: a, widthCm: a, heightCm: b }
  }
  return {
    lengthCm: round(numbers[0]),
    widthCm: round(numbers[1]),
    heightCm: round(numbers[2]),
  }
}

const getDensityGramPerCm3 = (rawMaterial: string | undefined): number => {
  const m = (rawMaterial ?? '').toLowerCase()
  if (!m) return 0.5

  if (m.includes('керамик')) return 2.0
  if (m.includes('стекл')) return 2.5
  if (m.includes('камень') || m.includes('камн')) return 2.7
  if (m.includes('металл')) return 7.8
  if (m.includes('дерев') || m.includes('бамбук') || m.includes('ротанг')) return 0.6
  if (m.includes('воск') || m.includes('соев')) return 0.9
  if (m.includes('хлопок') || m.includes('лён') || m.includes('лен')) return 0.3
  if (m.includes('атлас') || m.includes('бархат') || m.includes('текстиль') || m.includes('ткань'))
    return 0.3
  if (m.includes('нейлон') || m.includes('полипропилен')) return 0.9
  if (m.includes('бумага') || m.includes('картон')) return 0.7
  if (m.includes('солом')) return 0.1
  if (m.includes('водоросл')) return 0.2
  if (m.includes('растительн')) return 0.5
  if (m.includes('искусственная кожа')) return 0.9

  return 0.5
}

const isHollowMaterial = (rawMaterial: string | undefined): boolean => {
  const m = (rawMaterial ?? '').toLowerCase()
  return (
    m.includes('керамик') ||
    m.includes('стекл') ||
    m.includes('металл') ||
    m.includes('дерев') ||
    m.includes('ротанг') ||
    m.includes('камень')
  )
}

/**
 * Estimated product weight in grams from material and volume.
 * Used only when exact weight is not provided in the registry.
 */
export const estimateWeightGrams = (
  dims: ParsedDimensions,
  material: string | undefined,
): number => {
  const volumeCm3 = dims.lengthCm * dims.widthCm * dims.heightCm
  const density = getDensityGramPerCm3(material)
  const solidness = isHollowMaterial(material) ? 0.4 : 1.0
  const grams = Math.round(volumeCm3 * density * solidness)
  return Math.max(100, Math.min(30_000, grams))
}

const COLOR_KEYWORDS = [
  'белый',
  'чёрный',
  'черный',
  'серый',
  'бежевый',
  'беж',
  'коричневый',
  'красный',
  'розовый',
  'оранжевый',
  'жёлтый',
  'желтый',
  'зелёный',
  'зеленый',
  'голубой',
  'синий',
  'фиолетовый',
  'кремовый',
  'молочный',
  'золотой',
  'серебряный',
  'олива',
  'оливковый',
  'бордовый',
  'натуральный',
  'соломенный',
  'антик',
  'бисквит',
  'микс',
]

export const parseColorTags = (raw: string | undefined): string[] => {
  if (!raw) return []
  const lower = raw.toLowerCase()
  const found = new Set<string>()
  for (const keyword of COLOR_KEYWORDS) {
    const stem = keyword.replace(/(ый|ой|ий)$/, '')
    if (lower.includes(stem)) {
      found.add(keyword.replace(/ё/g, 'е'))
    }
  }
  return Array.from(found)
}
