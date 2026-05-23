import { describe, expect, it } from 'vitest'

import type { SyncResult } from '../types/catalog'

import {
  buildErrorSyncHistoryRow,
  buildSuccessSyncHistoryRow,
  CATALOG_SYNC_HISTORY_KEEP,
  normalizeCatalogSyncHistoryLimit,
} from './catalog-sync-history.helpers'

const sampleResult: SyncResult = {
  totalRows: 1012,
  syncedProducts: 261,
  skippedProducts: 751,
  skippedByRule: 0,
  errors: [],
  durationMs: 248_000,
}

describe('normalizeCatalogSyncHistoryLimit', () => {
  it('defaults invalid to 3 and caps at 10', () => {
    expect(normalizeCatalogSyncHistoryLimit(undefined)).toBe(CATALOG_SYNC_HISTORY_KEEP)
    expect(normalizeCatalogSyncHistoryLimit(0)).toBe(CATALOG_SYNC_HISTORY_KEEP)
    expect(normalizeCatalogSyncHistoryLimit(99)).toBe(10)
    expect(normalizeCatalogSyncHistoryLimit(3)).toBe(3)
  })
})

describe('buildSuccessSyncHistoryRow', () => {
  it('maps sync result fields', () => {
    const row = buildSuccessSyncHistoryRow(42, sampleResult)
    expect(row).toEqual({
      adminTelegramId: 42,
      status: 'success',
      syncedProducts: 261,
      skippedProducts: 751,
      totalRows: 1012,
      errorMessage: null,
      durationMs: 248_000,
    })
  })
})

describe('buildErrorSyncHistoryRow', () => {
  it('maps error with zero synced products', () => {
    const row = buildErrorSyncHistoryRow(99, new Error('Drive timeout'))
    expect(row.status).toBe('error')
    expect(row.syncedProducts).toBe(0)
    expect(row.errorMessage).toBe('Drive timeout')
    expect(row.skippedProducts).toBeNull()
  })
})
