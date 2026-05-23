import type { SyncResult } from '../types/catalog'

export const CATALOG_SYNC_HISTORY_KEEP = 3
export const CATALOG_SYNC_HISTORY_MAX_LIMIT = 10

export type CatalogSyncRunStatus = 'success' | 'error'

export type CatalogSyncHistoryRowInput = {
  adminTelegramId: number
  status: CatalogSyncRunStatus
  syncedProducts: number
  skippedProducts: number | null
  totalRows: number | null
  errorMessage: string | null
  durationMs: number | null
}

export const normalizeCatalogSyncHistoryLimit = (limit: unknown): number => {
  const parsed = Number(limit)
  if (!Number.isInteger(parsed) || parsed < 1) return CATALOG_SYNC_HISTORY_KEEP
  return Math.min(parsed, CATALOG_SYNC_HISTORY_MAX_LIMIT)
}

export const buildSuccessSyncHistoryRow = (
  adminTelegramId: number,
  result: SyncResult,
): CatalogSyncHistoryRowInput => ({
  adminTelegramId,
  status: 'success',
  syncedProducts: result.syncedProducts,
  skippedProducts: result.skippedProducts,
  totalRows: result.totalRows,
  errorMessage: null,
  durationMs: result.durationMs ?? null,
})

export const buildErrorSyncHistoryRow = (
  adminTelegramId: number,
  error: unknown,
): CatalogSyncHistoryRowInput => ({
  adminTelegramId,
  status: 'error',
  syncedProducts: 0,
  skippedProducts: null,
  totalRows: null,
  errorMessage: error instanceof Error ? error.message : String(error),
  durationMs: null,
})
