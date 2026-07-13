import { notifyAdminsAutoSyncFailed } from './order-notifications.service'
import { getSyncSchedule, markAutoRun } from './sync-schedule.service'
import {
  getCatalogSyncJobState,
  isCatalogSyncRunning,
  startCatalogSyncJob,
} from './sync-job-state'
import { alreadyRanTodayMsk, currentMskHour } from './sync-scheduler.helpers'
import { env } from '../utils/env'

export { alreadyRanTodayMsk, currentMskHour } from './sync-scheduler.helpers'

const AUTO_SYNC_ADMIN_ID = 0
const POLL_MS = 5000
const MAX_WAIT_MS = 15 * 60 * 1000

const handleJobTerminalState = async (state: ReturnType<typeof getCatalogSyncJobState>): Promise<boolean> => {
  if (state.status === 'success') {
    console.log('[sync-scheduler] auto sync success', state.result?.syncedProducts)
    return true
  }

  if (state.status === 'error') {
    console.error('[sync-scheduler] auto sync error', state.error)
    try {
      await notifyAdminsAutoSyncFailed(state.error ?? 'Неизвестная ошибка')
    } catch {
      // notification failure must not crash scheduler
    }
    return true
  }

  return false
}

const waitForJobAndNotify = async (): Promise<void> => {
  const startedAt = Date.now()

  if (await handleJobTerminalState(getCatalogSyncJobState())) {
    return
  }

  return new Promise((resolve) => {
    const timer = setInterval(() => {
      void (async () => {
        if (await handleJobTerminalState(getCatalogSyncJobState())) {
          clearInterval(timer)
          resolve()
          return
        }

        if (Date.now() - startedAt > MAX_WAIT_MS) {
          clearInterval(timer)
          resolve()
        }
      })()
    }, POLL_MS)
  })
}

export const runSyncSchedulerTick = async (): Promise<void> => {
  try {
    if (env.isCatalogCrmMode) {
      console.log('[sync-scheduler] skipped: catalog source is crm')
      return
    }

    const schedule = await getSyncSchedule()
    if (!schedule.enabled) return
    if (currentMskHour() !== schedule.hourMsk) return
    if (alreadyRanTodayMsk(schedule.lastAutoRunAt)) return
    if (isCatalogSyncRunning()) return

    const started = startCatalogSyncJob(AUTO_SYNC_ADMIN_ID)
    if (!started) return

    await markAutoRun()
    await waitForJobAndNotify()
  } catch (error) {
    console.error('[sync-scheduler] tick failed', error)
  }
}
