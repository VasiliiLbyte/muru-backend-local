import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { allocateUniqueSlug, slugifyLatin } from '../services/slug-translit'

export type ProductSlugRow = {
  sku: string
  name: string
  slug: string | null
}

export type BackfillArgs = {
  force: boolean
}

export const parseBackfillArgs = (argv: string[]): BackfillArgs => ({
  force: argv.includes('--force'),
})

/** Minimal CSV parse for products_map: sku + final_slug columns. */
export const loadFinalSlugsFromProductsMap = (csvPath: string): Map<string, string> => {
  const raw = readFileSync(csvPath, 'utf8').replace(/\r\n/g, '\n').trim().split('\n')
  const header = raw[0]?.split(',') ?? []
  const skuIdx = header.indexOf('sku')
  const finalIdx = header.indexOf('final_slug')
  if (skuIdx < 0 || finalIdx < 0) {
    throw new Error(`products_map.csv missing sku/final_slug columns: ${csvPath}`)
  }
  const map = new Map<string, string>()
  for (const line of raw.slice(1)) {
    if (!line.trim()) continue
    const cols = parseCsvLine(line)
    const sku = cols[skuIdx]?.trim()
    const finalSlug = cols[finalIdx]?.trim()
    if (sku && finalSlug) map.set(sku, finalSlug)
  }
  return map
}

/** RFC4180-ish split respecting quotes. */
export const parseCsvLine = (line: string): string[] => {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

export type BackfillPlanItem = {
  sku: string
  slug: string
  source: 'csv' | 'auto'
}

export type BackfillPlan = {
  updates: BackfillPlanItem[]
  skipped: number
  fromCsv: number
  auto: number
  collisions: number
}

/**
 * Pure planner: CSV final_slug wins; others autotranslit + unique vs taken.
 * Does not overwrite non-empty slug unless force.
 */
export const planProductSlugBackfill = (
  rows: ProductSlugRow[],
  csvSlugs: Map<string, string>,
  args: BackfillArgs,
): BackfillPlan => {
  const sorted = [...rows].sort((a, b) => a.sku.localeCompare(b.sku, 'en'))
  const taken = new Set<string>()
  for (const row of sorted) {
    if (row.slug && !args.force) taken.add(row.slug)
  }

  const updates: BackfillPlanItem[] = []
  let skipped = 0
  let fromCsv = 0
  let auto = 0
  let collisions = 0

  for (const row of sorted) {
    if (row.slug && !args.force) {
      skipped += 1
      continue
    }

    const csvSlug = csvSlugs.get(row.sku)
    if (csvSlug) {
      if (taken.has(csvSlug) && csvSlug !== row.slug) {
        // CSV is authoritative for this SKU; still assign as-is (DB unique later).
        collisions += 1
      }
      taken.add(csvSlug)
      updates.push({ sku: row.sku, slug: csvSlug, source: 'csv' })
      fromCsv += 1
      continue
    }

    const base = slugifyLatin(row.name) || 'product'
    const before = new Set(taken)
    const allocated = allocateUniqueSlug(base, taken)
    if (allocated !== base || before.has(base)) collisions += 1
    updates.push({ sku: row.sku, slug: allocated, source: 'auto' })
    auto += 1
  }

  return { updates, skipped, fromCsv, auto, collisions }
}

export const defaultProductsMapPath = (): string =>
  join(__dirname, '../db/data/url-migration-2026-07-28/products_map.csv')
