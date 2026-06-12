const MSK_OFFSET_MS = 3 * 3_600_000

export const currentMskHour = (now: Date = new Date()): number => (now.getUTCHours() + 3) % 24

export const mskCalendarDay = (isoOrDate: string | Date): string => {
  const time = typeof isoOrDate === 'string' ? new Date(isoOrDate).getTime() : isoOrDate.getTime()
  return new Date(time + MSK_OFFSET_MS).toISOString().slice(0, 10)
}

export const alreadyRanTodayMsk = (lastAutoRunAt: string | null, now: Date = new Date()): boolean => {
  if (!lastAutoRunAt) return false
  return mskCalendarDay(lastAutoRunAt) === mskCalendarDay(now)
}
