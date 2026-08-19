import { describe, expect, it } from 'vitest'

import {
  buildProductTextSearchCondition,
  buildSearchRankExpression,
  computeSearchRankScore,
  isSearchQueryValid,
  normalizeSearchQuery,
  tokenizeSearchQuery,
} from './catalog-product-search'

describe('normalizeSearchQuery', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeSearchQuery('  ваза   керамика  ')).toBe('ваза керамика')
  })
})

describe('tokenizeSearchQuery', () => {
  it('drops tokens shorter than 2 chars and dedupes case-insensitively', () => {
    expect(tokenizeSearchQuery('ваза a керамика Ваза')).toEqual(['ваза', 'керамика'])
  })

  it('treats word order as equivalent token sets', () => {
    const a = new Set(tokenizeSearchQuery('ваза керамика'))
    const b = new Set(tokenizeSearchQuery('керамика ваза'))
    expect(a).toEqual(b)
  })
})

describe('isSearchQueryValid', () => {
  it('rejects single-char queries', () => {
    expect(isSearchQueryValid('a')).toBe(false)
  })

  it('accepts two-char queries', () => {
    expect(isSearchQueryValid('ва')).toBe(true)
  })

  it('rejects whitespace-only', () => {
    expect(isSearchQueryValid('   ')).toBe(false)
  })
})

describe('buildProductTextSearchCondition', () => {
  it('returns null for empty or invalid query', () => {
    const values: Array<string | number> = ['existing']
    expect(buildProductTextSearchCondition(values, '')).toBeNull()
    expect(buildProductTextSearchCondition(values, 'a')).toBeNull()
    expect(values).toEqual(['existing'])
  })

  it('builds multi-token AND clause with trigram fallback', () => {
    const values: Array<string | number> = []
    const sql = buildProductTextSearchCondition(values, 'ваза керамика')

    expect(sql).toContain(' AND ')
    expect(sql).toContain('similarity(p.search_document')
    expect(sql).toContain('jsonb_each_text(p.specs)')
    expect(values.filter((v) => typeof v === 'string' && String(v).includes('%ваза%'))).toHaveLength(1)
    expect(values.filter((v) => typeof v === 'string' && String(v).includes('%керамика%'))).toHaveLength(1)
  })

  it('uses next parameter index when values already populated', () => {
    const values: Array<string | number> = ['slug-value']
    const sql = buildProductTextSearchCondition(values, 'ваза')

    expect(sql).toMatch(/\$\d+/)
    expect(values[0]).toBe('slug-value')
    expect(values.length).toBeGreaterThan(1)
  })
})

describe('buildSearchRankExpression', () => {
  it('includes weighted CASE and similarity tiebreak', () => {
    const values: Array<string | number> = []
    const sql = buildSearchRankExpression(values, 'ваза', ['ваза'])

    expect(sql).toContain('WHEN lower(p.name) = lower(')
    expect(sql).toContain('similarity(coalesce(p.search_document')
    expect(values.length).toBeGreaterThan(0)
  })
})

describe('computeSearchRankScore', () => {
  it('ranks name match above description-only', () => {
    const nameScore = computeSearchRankScore({
      exactName: true,
      namePrefix: false,
      exactSku: false,
      categoryMatch: false,
      specsColorMatch: false,
      descriptionOnly: false,
      trigramSimilarity: 0.1,
    })
    const descriptionScore = computeSearchRankScore({
      exactName: false,
      namePrefix: false,
      exactSku: false,
      categoryMatch: false,
      specsColorMatch: false,
      descriptionOnly: true,
      trigramSimilarity: 0.5,
    })
    expect(nameScore).toBeGreaterThan(descriptionScore)
  })
})
