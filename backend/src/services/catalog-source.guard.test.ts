import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { catalogSource: 'sheets' as 'sheets' | 'crm' },
}))

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

import { assertCatalogCrmWritable, CatalogLockedError, isCatalogCrmWritable } from './catalog-source.guard'

describe('catalog-source.guard', () => {
  beforeEach(() => {
    mockEnv.catalogSource = 'sheets'
  })

  it('isCatalogCrmWritable is false in sheets mode', () => {
    expect(isCatalogCrmWritable()).toBe(false)
  })

  it('assertCatalogCrmWritable throws CatalogLockedError in sheets mode', () => {
    expect(() => assertCatalogCrmWritable()).toThrow(CatalogLockedError)
  })

  it('allows mutations in crm mode', () => {
    mockEnv.catalogSource = 'crm'
    expect(isCatalogCrmWritable()).toBe(true)
    expect(() => assertCatalogCrmWritable()).not.toThrow()
  })
})
