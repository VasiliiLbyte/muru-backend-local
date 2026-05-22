import type { CatalogSyncProgress, SyncResult } from '../types/catalog'
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

export const startCatalogSyncJob = (): boolean => {
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
