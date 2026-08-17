import { describe, expect, it } from 'vitest'

import {
  collectEnvSanityWarnings,
  ENV_SANITY_KEY_THRESHOLD,
  formatEnvCheckLine,
} from './env-sanity'

const base = {
  fileKeyCount: 61,
  filePort: '4000',
  fileCatalogSource: 'crm',
  processPort: '4000',
  processCatalogSource: 'crm',
  effectivePort: 4000,
  effectiveCatalogSource: 'crm',
  nodeEnv: 'production',
}

describe('env-sanity', () => {
  it('formats the env-check line from effective values', () => {
    expect(formatEnvCheckLine({ keys: 61, port: 4000, catalogSource: 'crm' })).toBe(
      '[env-check] keys=61 PORT=4000 CATALOG_SOURCE=crm',
    )
  })

  it('warns when file key count is below threshold', () => {
    const warnings = collectEnvSanityWarnings({ ...base, fileKeyCount: 18, nodeEnv: 'development' })
    expect(warnings.some((w) => w.includes('key count 18'))).toBe(true)
    expect(ENV_SANITY_KEY_THRESHOLD).toBe(40)
  })

  it('warns on PORT file vs process mismatch (stale PM2)', () => {
    const warnings = collectEnvSanityWarnings({
      ...base,
      filePort: '4000',
      processPort: '4001',
      nodeEnv: 'development',
    })
    expect(warnings.some((w) => w.includes('PORT mismatch'))).toBe(true)
  })

  it('warns on CATALOG_SOURCE file vs process mismatch', () => {
    const warnings = collectEnvSanityWarnings({
      ...base,
      fileCatalogSource: 'crm',
      processCatalogSource: 'sheets',
      nodeEnv: 'development',
    })
    expect(warnings.some((w) => w.includes('CATALOG_SOURCE mismatch'))).toBe(true)
  })

  it('production 4000 + crm has no invariant warnings when file matches process', () => {
    expect(collectEnvSanityWarnings(base)).toEqual([])
  })

  it('production 4000 + sheets warns on catalog source', () => {
    const warnings = collectEnvSanityWarnings({
      ...base,
      fileCatalogSource: 'sheets',
      processCatalogSource: 'sheets',
      effectiveCatalogSource: 'sheets',
    })
    expect(warnings.some((w) => w.includes('expected crm'))).toBe(true)
  })

  it('staging port 4001 + sheets does not warn on CATALOG_SOURCE', () => {
    const warnings = collectEnvSanityWarnings({
      ...base,
      filePort: '4001',
      processPort: '4001',
      fileCatalogSource: 'sheets',
      processCatalogSource: 'sheets',
      effectivePort: 4001,
      effectiveCatalogSource: 'sheets',
    })
    expect(warnings.some((w) => w.includes('CATALOG_SOURCE'))).toBe(false)
    expect(warnings.some((w) => w.includes('expected crm'))).toBe(false)
  })
})
