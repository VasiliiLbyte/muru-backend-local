import type { SyncResult } from '../types/catalog'
import { syncCatalogFromGoogle } from './google-sync'

export type CatalogSyncJobStatus = 'idle' | 'running' | 'success' | 'error'

export type CatalogSyncJobState = {
  status: CatalogSyncJobStatus
  startedAt: string | null
  finishedAt: string | null
  result: SyncResult | null
  error: string | null
}

let state: CatalogSyncJobState = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  result: null,
  error: null,
}

export const getCatalogSyncJobState = (): CatalogSyncJobState => ({ ...state })

export const isCatalogSyncRunning = (): boolean => state.status === 'running'

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
  }

  void (async () => {
    try {
      const result = await syncCatalogFromGoogle()
      state = {
        status: 'success',
        startedAt: state.startedAt,
        finishedAt: new Date().toISOString(),
        result,
        error: null,
      }
    } catch (error) {
      state = {
        status: 'error',
        startedAt: state.startedAt,
        finishedAt: new Date().toISOString(),
        result: null,
        error: error instanceof Error ? error.message : 'Sync failed',
      }
    }
  })()

  return true
}
