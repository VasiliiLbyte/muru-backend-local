import type { SyncResult } from '../types/catalog'
import { pool } from '../utils/db'

import {
  buildErrorSyncHistoryRow,
  buildSuccessSyncHistoryRow,
  CATALOG_SYNC_HISTORY_KEEP,
  normalizeCatalogSyncHistoryLimit,
  type CatalogSyncHistoryRowInput,
  type CatalogSyncRunStatus,
} from './catalog-sync-history.helpers'

export type CatalogSyncHistoryItem = {
  id: number
  adminTelegramId: number
  status: CatalogSyncRunStatus
  syncedProducts: number
  skippedProducts: number | null
  totalRows: number | null
  errorMessage: string | null
  finishedAt: string
  durationMs: number | null
}

type DbCatalogSyncLogRow = {
  id: number
  admin_telegram_id: string
  status: CatalogSyncRunStatus
  synced_products: number
  skipped_products: number | null
  total_rows: number | null
  error_message: string | null
  finished_at: Date
  duration_ms: number | null
}

const mapRow = (row: DbCatalogSyncLogRow): CatalogSyncHistoryItem => ({
  id: row.id,
  adminTelegramId: Number(row.admin_telegram_id),
  status: row.status,
  syncedProducts: row.synced_products,
  skippedProducts: row.skipped_products,
  totalRows: row.total_rows,
  errorMessage: row.error_message,
  finishedAt: row.finished_at.toISOString(),
  durationMs: row.duration_ms,
})

const insertRow = async (input: CatalogSyncHistoryRowInput): Promise<void> => {
  await pool.query(
    `INSERT INTO catalog_sync_log (
      admin_telegram_id,
      status,
      synced_products,
      skipped_products,
      total_rows,
      error_message,
      duration_ms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.adminTelegramId,
      input.status,
      input.syncedProducts,
      input.skippedProducts,
      input.totalRows,
      input.errorMessage,
      input.durationMs,
    ],
  )
}

const pruneOldRuns = async (keep: number = CATALOG_SYNC_HISTORY_KEEP): Promise<void> => {
  await pool.query(
    `DELETE FROM catalog_sync_log
     WHERE id NOT IN (
       SELECT id FROM catalog_sync_log ORDER BY finished_at DESC LIMIT $1
     )`,
    [keep],
  )
}

export const recordCatalogSyncRun = async (params: {
  adminTelegramId: number
  status: 'success'
  result: SyncResult
}): Promise<void> => {
  await insertRow(buildSuccessSyncHistoryRow(params.adminTelegramId, params.result))
  await pruneOldRuns()
}

export const recordCatalogSyncError = async (params: {
  adminTelegramId: number
  error: unknown
}): Promise<void> => {
  await insertRow(buildErrorSyncHistoryRow(params.adminTelegramId, params.error))
  await pruneOldRuns()
}

export const listCatalogSyncHistory = async (
  limit: unknown = CATALOG_SYNC_HISTORY_KEEP,
): Promise<CatalogSyncHistoryItem[]> => {
  const safeLimit = normalizeCatalogSyncHistoryLimit(limit)
  const { rows } = await pool.query<DbCatalogSyncLogRow>(
    `SELECT
      id,
      admin_telegram_id,
      status,
      synced_products,
      skipped_products,
      total_rows,
      error_message,
      finished_at,
      duration_ms
    FROM catalog_sync_log
    ORDER BY finished_at DESC
    LIMIT $1`,
    [safeLimit],
  )
  return rows.map(mapRow)
}
