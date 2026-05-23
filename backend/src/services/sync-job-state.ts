import type { CatalogSyncProgress, SyncResult } from '../types/catalog'
import {
  recordCatalogSyncError,
  recordCatalogSyncRun,
} from './catalog-sync-history.service'
import { syncCatalogFromGoogle } from './google-sync'

export type CatalogSyncJobStatus = 'idle' | 'running' | 'success' | 'error'

export type CatalogSyncJobState = {
  status: CatalogSyncJobStatus
  startedAt: string | null
  finishedAt: string | null
  result: SyncResult | null
  error: string | null
  progress: CatalogSyncProgress | null
}

let state: CatalogSyncJobState = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  result: null,
  error: null,
  progress: null,
}

export const getCatalogSyncJobState = (): CatalogSyncJobState => ({
  ...state,
  progress: state.progress ? { ...state.progress } : null,
})

export const isCatalogSyncRunning = (): boolean => state.status === 'running'

const setProgress = (progress: CatalogSyncProgress) => {
  state = { ...state, progress }
}

export const startCatalogSyncJob = (adminTelegramId: number): boolean => {
  if (state.status === 'running') {
    return false
  }

  state = {
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    result: null,
    error: null,
    progress: {
      phase: 'sheet',
      message: 'Запуск синхронизации каталога…',
    },
  }

  void (async () => {
    try {
      const result = await syncCatalogFromGoogle(setProgress)
      try {
        await recordCatalogSyncRun({ adminTelegramId, status: 'success', result })
      } catch (logError) {
        console.error('[catalog-sync-history] failed to record success', logError)
      }
      state = {
        status: 'success',
        startedAt: state.startedAt,
        finishedAt: new Date().toISOString(),
        result,
        error: null,
        progress: {
          phase: 'done',
          message: `Готово: синхронизировано ${result.syncedProducts} товаров.`,
          processedProducts: result.syncedProducts,
        },
      }
    } catch (error) {
      try {
        await recordCatalogSyncError({ adminTelegramId, error })
      } catch (logError) {
        console.error('[catalog-sync-history] failed to record error', logError)
      }
      state = {
        status: 'error',
        startedAt: state.startedAt,
        finishedAt: new Date().toISOString(),
        result: null,
        error: error instanceof Error ? error.message : 'Sync failed',
        progress: {
          phase: 'done',
          message: 'Ошибка синхронизации каталога.',
        },
      }
    }
  })()

  return true
}
