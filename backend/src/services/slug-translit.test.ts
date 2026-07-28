import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SALE_CATEGORY_SLUG } from './catalog-sale.helpers'
import { slugify } from './crm-catalog.helpers'
import {
  allocateUniqueSlug,
  resolveUniqueSlugsBySku,
  slugifyLatin,
} from './slug-translit'

const goldensPath = join(
  __dirname,
  '../db/data/url-migration-2026-07-28/translit_goldens.csv',
)

type GoldenRow = { title: string; muruSlug: string; translit: string; match: string }

const loadGoldens = (): GoldenRow[] => {
  const raw = readFileSync(goldensPath, 'utf8').replace(/\r\n/g, '\n').trim().split('\n').slice(1)
  return raw.map((line) => {
    const [title, muruSlug, translit, match] = line.split(',').map((p) => p.trim())
    return { title: title!, muruSlug: muruSlug!, translit: translit!, match: match! }
  })
}

describe('slugifyLatin / Bitrix translit', () => {
  const goldens = loadGoldens()

  it('matches 26 muru.ru golden pairs (match=yes)', () => {
    const yes = goldens.filter((g) => g.match === 'yes')
    expect(yes.length).toBe(26)
    for (const row of yes) {
      expect(slugifyLatin(row.title), row.title).toBe(row.muruSlug)
    }
  })

  it('Подсвечники → podsvechniki (not Bitrix podsvechniki1)', () => {
    expect(slugifyLatin('Подсвечники')).toBe('podsvechniki')
    const bitrixDup = goldens.find((g) => g.muruSlug === 'podsvechniki1')
    expect(bitrixDup).toBeTruthy()
    expect(slugifyLatin(bitrixDup!.title)).toBe('podsvechniki')
  })

  it('SALE_CATEGORY_SLUG is rasprodazha after latin slugify', () => {
    expect(SALE_CATEGORY_SLUG).toBe('rasprodazha')
    expect(slugify('Распродажа')).toBe('rasprodazha')
  })

  it('allocateUniqueSlug appends -2, -3', () => {
    const taken = new Set<string>()
    expect(allocateUniqueSlug('vaza', taken)).toBe('vaza')
    expect(allocateUniqueSlug('vaza', taken)).toBe('vaza-2')
    expect(allocateUniqueSlug('vaza', taken)).toBe('vaza-3')
  })

  it('resolveUniqueSlugsBySku is deterministic by SKU order', () => {
    const map = resolveUniqueSlugsBySku([
      { sku: 'MU0003', base: 'same' },
      { sku: 'MU0001', base: 'same' },
      { sku: 'MU0002', base: 'same' },
    ])
    expect(map.get('MU0001')).toBe('same')
    expect(map.get('MU0002')).toBe('same-2')
    expect(map.get('MU0003')).toBe('same-3')
  })
})
