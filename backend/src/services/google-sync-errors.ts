import type { SyncError, SyncErrorGroup } from '../types/catalog'

export const SYNC_REASON_MISSING_SKU = 'Нет артикула в строке таблицы'
export const SYNC_REASON_INVALID_ROW = 'Некорректные данные строки'
export const SYNC_REASON_DB_PREFIX = 'Ошибка записи в БД'

export const syncDbErrorReason = (message: string): string =>
  `${SYNC_REASON_DB_PREFIX}: ${message}`

const MAX_DETAIL_ERRORS = 20
const MAX_SAMPLE_SKUS_PER_GROUP = 5

export function summarizeSyncErrors(errors: SyncError[]): {
  errors: SyncError[]
  errorGroups: SyncErrorGroup[]
} {
  const groupMap = new Map<string, { count: number; sampleSkus: string[] }>()

  for (const err of errors) {
    const existing = groupMap.get(err.reason) ?? { count: 0, sampleSkus: [] }
    existing.count += 1
    if (
      existing.sampleSkus.length < MAX_SAMPLE_SKUS_PER_GROUP &&
      !existing.sampleSkus.includes(err.sku)
    ) {
      existing.sampleSkus.push(err.sku)
    }
    groupMap.set(err.reason, existing)
  }

  const errorGroups: SyncErrorGroup[] = [...groupMap.entries()]
    .map(([reason, data]) => ({
      reason,
      count: data.count,
      sampleSkus: data.sampleSkus,
    }))
    .sort((a, b) => b.count - a.count)

  const cappedDetail = errors.slice(0, MAX_DETAIL_ERRORS)

  return { errors: cappedDetail, errorGroups }
}
