import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()

vi.mock('../utils/db', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}))

import {
  getSyncSchedule,
  normalizeHourMsk,
  updateSyncSchedule,
} from './sync-schedule.service'

describe('normalizeHourMsk', () => {
  it('accepts preset hours 2, 4, 6', () => {
    expect(normalizeHourMsk(2)).toBe(2)
    expect(normalizeHourMsk(4)).toBe(4)
    expect(normalizeHourMsk(6)).toBe(6)
  })

  it('falls back to 4 for invalid hours', () => {
    expect(normalizeHourMsk(3)).toBe(4)
    expect(normalizeHourMsk(0)).toBe(4)
    expect(normalizeHourMsk(23)).toBe(4)
  })
})

describe('getSyncSchedule', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('returns defaults when row is missing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await expect(getSyncSchedule()).resolves.toEqual({
      enabled: false,
      hourMsk: 4,
      lastAutoRunAt: null,
    })
  })

  it('maps database row', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ enabled: true, hour_msk: 2, last_auto_run_at: new Date('2026-06-03T01:00:00.000Z') }],
    })
    await expect(getSyncSchedule()).resolves.toEqual({
      enabled: true,
      hourMsk: 2,
      lastAutoRunAt: '2026-06-03T01:00:00.000Z',
    })
  })
})

describe('updateSyncSchedule', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('clamps invalid hour and persists settings', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ enabled: true, hour_msk: 4, last_auto_run_at: null }],
      })

    const result = await updateSyncSchedule({ enabled: true, hourMsk: 99 })

    expect(queryMock.mock.calls[0][1]).toEqual([true, 4])
    expect(result).toEqual({ enabled: true, hourMsk: 4, lastAutoRunAt: null })
  })
})
