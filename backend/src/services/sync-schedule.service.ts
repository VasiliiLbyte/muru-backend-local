import { pool } from '../utils/db'

export type SyncSchedule = {
  enabled: boolean
  hourMsk: number
  lastAutoRunAt: string | null
}

const ALLOWED_HOURS_MSK = [2, 4, 6] as const

export const normalizeHourMsk = (hourMsk: number): number =>
  ALLOWED_HOURS_MSK.includes(hourMsk as (typeof ALLOWED_HOURS_MSK)[number]) ? hourMsk : 4

export const getSyncSchedule = async (): Promise<SyncSchedule> => {
  const { rows } = await pool.query<{
    enabled: boolean
    hour_msk: number
    last_auto_run_at: Date | null
  }>(`SELECT enabled, hour_msk, last_auto_run_at FROM sync_schedule_settings WHERE id = 1`)

  const row = rows[0]
  if (!row) {
    return { enabled: false, hourMsk: 4, lastAutoRunAt: null }
  }

  return {
    enabled: row.enabled,
    hourMsk: row.hour_msk,
    lastAutoRunAt: row.last_auto_run_at?.toISOString() ?? null,
  }
}

export const updateSyncSchedule = async (input: {
  enabled: boolean
  hourMsk: number
}): Promise<SyncSchedule> => {
  const hour = normalizeHourMsk(input.hourMsk)

  await pool.query(
    `UPDATE sync_schedule_settings SET enabled = $1, hour_msk = $2, updated_at = NOW() WHERE id = 1`,
    [input.enabled, hour],
  )

  return getSyncSchedule()
}

export const markAutoRun = async (): Promise<void> => {
  await pool.query(`UPDATE sync_schedule_settings SET last_auto_run_at = NOW() WHERE id = 1`)
}
