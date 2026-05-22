import type { CategoryCoverSyncResult } from '../types/catalog'

import type { CategoryCoverSyncProgress } from './category-cover-sync.service'
import { syncCategoryCoversFromDrive } from './category-cover-sync.service'

export type CategoryCoverSyncJobStatus = 'idle' | 'running' | 'success' | 'error'

export type CategoryCoverSyncJobState = {
  status: CategoryCoverSyncJobStatus
  startedAt: string | null
  finishedAt: string | null
  result: CategoryCoverSyncResult | null
  error: string | null
  progress: CategoryCoverSyncProgress | null
}

let state: CategoryCoverSyncJobState = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  result: null,
  error: null,
  progress: null,
}

export const getCategoryCoverSyncJobState = (): CategoryCoverSyncJobState => ({
  ...state,
  progress: state.progress ? { ...state.progress } : null,
})

export const isCategoryCoverSyncRunning = (): boolean => state.status === 'running'

const setProgress = (progress: CategoryCoverSyncProgress) => {
  state = { ...state, progress }
}

export const startCategoryCoverSyncJob = (): boolean => {
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
      phase: 'lookup',
      message: 'Запуск синхронизации обложек…',
    },
  }

  void (async () => {
    try {
      const result = await syncCategoryCoversFromDrive(setProgress)
      state = {
        status: 'success',
        startedAt: state.startedAt,
        finishedAt: new Date().toISOString(),
        result,
        error: null,
        progress: {
          phase: 'done',
          message: `Готово: обновлено ${result.updated} обложек.`,
          resolvedCount: result.updated,
        },
      }
    } catch (error) {
      state = {
        status: 'error',
        startedAt: state.startedAt,
        finishedAt: new Date().toISOString(),
        result: null,
        error: error instanceof Error ? error.message : 'Category cover sync failed',
        progress: {
          phase: 'done',
          message: 'Ошибка синхронизации обложек.',
        },
      }
    }
  })()

  return true
}
