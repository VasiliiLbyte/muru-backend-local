import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockEnv,
  getSyncScheduleMock,
  markAutoRunMock,
  isCatalogSyncRunningMock,
  startCatalogSyncJobMock,
  getCatalogSyncJobStateMock,
  notifyAdminsAutoSyncFailedMock,
} = vi.hoisted(() => ({
  mockEnv: { isCatalogCrmMode: false },
  getSyncScheduleMock: vi.fn(),
  markAutoRunMock: vi.fn(),
  isCatalogSyncRunningMock: vi.fn(),
  startCatalogSyncJobMock: vi.fn(),
  getCatalogSyncJobStateMock: vi.fn(),
  notifyAdminsAutoSyncFailedMock: vi.fn(),
}))

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

vi.mock('./sync-schedule.service', () => ({
  getSyncSchedule: (...args: unknown[]) => getSyncScheduleMock(...args),
  markAutoRun: (...args: unknown[]) => markAutoRunMock(...args),
}))

vi.mock('./sync-job-state', () => ({
  isCatalogSyncRunning: () => isCatalogSyncRunningMock(),
  startCatalogSyncJob: (...args: unknown[]) => startCatalogSyncJobMock(...args),
  getCatalogSyncJobState: () => getCatalogSyncJobStateMock(),
}))

vi.mock('./order-notifications.service', () => ({
  notifyAdminsAutoSyncFailed: (...args: unknown[]) => notifyAdminsAutoSyncFailedMock(...args),
}))

import { alreadyRanTodayMsk, currentMskHour } from './sync-scheduler.helpers'
import { runSyncSchedulerTick } from './sync-scheduler'

describe('sync-scheduler helpers', () => {
  it('computes MSK hour from UTC', () => {
    expect(currentMskHour(new Date('2026-06-03T01:00:00.000Z'))).toBe(4)
    expect(currentMskHour(new Date('2026-06-03T22:00:00.000Z'))).toBe(1)
  })

  it('detects same MSK calendar day', () => {
    expect(alreadyRanTodayMsk('2026-06-03T10:00:00.000Z', new Date('2026-06-03T20:00:00.000Z'))).toBe(
      true,
    )
    expect(alreadyRanTodayMsk('2026-06-02T10:00:00.000Z', new Date('2026-06-03T10:00:00.000Z'))).toBe(
      false,
    )
  })
})

describe('runSyncSchedulerTick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.isCatalogCrmMode = false
    isCatalogSyncRunningMock.mockReturnValue(false)
    startCatalogSyncJobMock.mockReturnValue(true)
    markAutoRunMock.mockResolvedValue(undefined)
    getCatalogSyncJobStateMock.mockReturnValue({ status: 'success', result: { syncedProducts: 10 } })
  })

  it('skips when schedule is disabled', async () => {
    getSyncScheduleMock.mockResolvedValue({
      enabled: false,
      hourMsk: 4,
      lastAutoRunAt: null,
    })

    await runSyncSchedulerTick()

    expect(startCatalogSyncJobMock).not.toHaveBeenCalled()
  })

  it('skips when already ran today in MSK', async () => {
    getSyncScheduleMock.mockResolvedValue({
      enabled: true,
      hourMsk: currentMskHour(),
      lastAutoRunAt: new Date().toISOString(),
    })

    await runSyncSchedulerTick()

    expect(startCatalogSyncJobMock).not.toHaveBeenCalled()
  })

  it('skips when manual sync is running', async () => {
    getSyncScheduleMock.mockResolvedValue({
      enabled: true,
      hourMsk: currentMskHour(),
      lastAutoRunAt: null,
    })
    isCatalogSyncRunningMock.mockReturnValue(true)

    await runSyncSchedulerTick()

    expect(startCatalogSyncJobMock).not.toHaveBeenCalled()
  })

  it('starts auto sync and marks run when conditions match', async () => {
    getSyncScheduleMock.mockResolvedValue({
      enabled: true,
      hourMsk: currentMskHour(),
      lastAutoRunAt: null,
    })

    await runSyncSchedulerTick()

    expect(startCatalogSyncJobMock).toHaveBeenCalledWith(0)
    expect(markAutoRunMock).toHaveBeenCalled()
    expect(notifyAdminsAutoSyncFailedMock).not.toHaveBeenCalled()
  })

  it('notifies admins on auto sync error', async () => {
    getSyncScheduleMock.mockResolvedValue({
      enabled: true,
      hourMsk: currentMskHour(),
      lastAutoRunAt: null,
    })
    getCatalogSyncJobStateMock.mockReturnValue({ status: 'error', error: 'Google auth failed' })

    await runSyncSchedulerTick()

    expect(notifyAdminsAutoSyncFailedMock).toHaveBeenCalledWith('Google auth failed')
  })

  it('skips tick when catalog source is crm', async () => {
    mockEnv.isCatalogCrmMode = true
    getSyncScheduleMock.mockResolvedValue({
      enabled: true,
      hourMsk: currentMskHour(),
      lastAutoRunAt: null,
    })

    await runSyncSchedulerTick()

    expect(getSyncScheduleMock).not.toHaveBeenCalled()
    expect(startCatalogSyncJobMock).not.toHaveBeenCalled()
  })
})
