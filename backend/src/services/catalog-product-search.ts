/** Trigram similarity threshold for typo-tolerant matching. */
export const SEARCH_TRIGRAM_THRESHOLD = 0.3

export const normalizeSearchQuery = (q: string): string =>
  q.trim().replace(/\s+/g, ' ')

export const tokenizeSearchQuery = (q: string): string[] => {
  const normalized = normalizeSearchQuery(q)
  if (!normalized) return []
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const raw of normalized.split(' ')) {
    const token = raw.trim()
    if (token.length < 2) continue
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tokens.push(token)
  }
  return tokens
}

export const isSearchQueryValid = (q: string): boolean => {
  const normalized = normalizeSearchQuery(q)
  if (normalized.length < 2) return false
  return tokenizeSearchQuery(normalized).length > 0
}

const pushSearchParam = (
  values: Array<string | number>,
  value: string | number,
): number => {
  values.push(value)
  return values.length
}

const buildTokenMatchClause = (
  values: Array<string | number>,
  token: string,
): string => {
  const patternIdx = pushSearchParam(values, `%${token}%`)
  const tokenIdx = pushSearchParam(values, token)
  const thresholdIdx = pushSearchParam(values, SEARCH_TRIGRAM_THRESHOLD)

  return `(
    p.search_document ILIKE $${patternIdx}
    OR p.name ILIKE $${patternIdx}
    OR p.sku ILIKE $${patternIdx}
    OR p.description ILIKE $${patternIdx}
    OR c.name ILIKE $${patternIdx}
    OR p.web_subcategory_name ILIKE $${patternIdx}
    OR p.subcategory ILIKE $${patternIdx}
    OR p.color ILIKE $${patternIdx}
    OR EXISTS (
      SELECT 1
      FROM unnest(p.color_tags) AS t(tag)
      WHERE tag ILIKE $${patternIdx}
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_each_text(p.specs) AS s(k, v)
      WHERE s.v ILIKE $${patternIdx}
        OR similarity(s.v, $${tokenIdx}) >= $${thresholdIdx}::double precision
    )
    OR similarity(p.search_document, $${tokenIdx}) >= $${thresholdIdx}::double precision
    OR p.search_document % $${tokenIdx}
  )`
}

/** Token + trigram filter for product list queries. */
export const buildProductTextSearchCondition = (
  values: Array<string | number>,
  q: string,
): string | null => {
  if (!isSearchQueryValid(q)) return null
  const tokens = tokenizeSearchQuery(q)
  if (tokens.length === 0) return null
  const tokenClauses = tokens.map((token) => buildTokenMatchClause(values, token))
  return `(${tokenClauses.join(' AND ')})`
}

/** SQL expression aliased as search_rank in SELECT / ORDER BY. */
export const buildSearchRankExpression = (
  values: Array<string | number>,
  q: string,
  tokens: string[],
): string => {
  const normalized = normalizeSearchQuery(q)
  const fullQIdx = pushSearchParam(values, normalized)
  const fullQPatternIdx = pushSearchParam(values, `${normalized}%`)
  const fullQUpperIdx = pushSearchParam(values, normalized.toUpperCase())

  const tokenPatterns: number[] = []
  for (const token of tokens) {
    tokenPatterns.push(pushSearchParam(values, `%${token}%`))
  }

  const categoryMatch = tokenPatterns
    .map((idx) => `(c.name ILIKE $${idx} OR p.web_subcategory_name ILIKE $${idx} OR p.subcategory ILIKE $${idx})`)
    .join(' OR ')

  const specsColorMatch = tokenPatterns
    .map(
      (idx) => `(
        p.color ILIKE $${idx}
        OR EXISTS (SELECT 1 FROM unnest(p.color_tags) AS t(tag) WHERE tag ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM jsonb_each_text(p.specs) AS s(k, v) WHERE s.v ILIKE $${idx})
      )`,
    )
    .join(' OR ')

  const descriptionOnlyMatch = tokenPatterns
    .map((idx) => `(p.description ILIKE $${idx} AND p.name NOT ILIKE $${idx} AND p.sku NOT ILIKE $${idx})`)
    .join(' OR ')

  return `(
    CASE
      WHEN lower(p.name) = lower($${fullQIdx}) THEN 100
      WHEN p.name ILIKE $${fullQPatternIdx} THEN 80
      WHEN upper(p.sku) = $${fullQUpperIdx} THEN 75
      WHEN ${categoryMatch || 'FALSE'} THEN 40
      WHEN ${specsColorMatch || 'FALSE'} THEN 20
      WHEN ${descriptionOnlyMatch || 'FALSE'} THEN 10
      ELSE 0
    END
    + similarity(coalesce(p.search_document, ''), $${fullQIdx})
  )`
}

export type SearchRankSignals = {
  exactName: boolean
  namePrefix: boolean
  exactSku: boolean
  categoryMatch: boolean
  specsColorMatch: boolean
  descriptionOnly: boolean
  trigramSimilarity: number
}

/** Pure rank scorer for unit tests (mirrors SQL CASE weights). */
export const computeSearchRankScore = (
  signals: SearchRankSignals,
): number => {
  let score = 0
  if (signals.exactName) score = 100
  else if (signals.namePrefix) score = 80
  else if (signals.exactSku) score = 75
  else if (signals.categoryMatch) score = 40
  else if (signals.specsColorMatch) score = 20
  else if (signals.descriptionOnly) score = 10
  return score + signals.trigramSimilarity
}
