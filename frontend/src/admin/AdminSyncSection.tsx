import { useCallback, useEffect, useState } from 'react'

import {
  fetchCatalogSyncHistory,
  fetchCatalogSyncStatus,
  triggerCatalogSync,
  type CatalogSyncHistoryItem,
  type CatalogSyncProgress,
  type SyncApiResult,
} from '../lib/api'
import { pressable, pressableDisabled } from '../lib/uiClasses'

type AdminSyncSectionProps = {
  userId: number
  onOpenCategories: () => void
}

type SyncStatus = 'idle' | 'in-progress' | 'success' | 'error'

const formatDurationSec = (durationMs?: number | null) =>
  durationMs != null ? `${Math.round(durationMs / 1000)} с` : null

const formatFinishedAt = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('ru-RU')
  } catch {
    return iso
  }
}

const formatHistoryLine = (entry: CatalogSyncHistoryItem): string => {
  const when = formatFinishedAt(entry.finishedAt)
  if (entry.status === 'success') {
    return `${when} — успешно — ${entry.syncedProducts} товаров — админ ${entry.adminTelegramId}`
  }
  const err = entry.errorMessage ? ` — ${entry.errorMessage}` : ''
  return `${when} — ошибка — админ ${entry.adminTelegramId}${err}`
}

const historyToPartialResult = (entry: CatalogSyncHistoryItem): SyncApiResult => ({
  totalRows: entry.totalRows ?? 0,
  syncedProducts: entry.syncedProducts,
  skippedProducts: entry.skippedProducts ?? 0,
  errors: [],
  durationMs: entry.durationMs ?? undefined,
})

export const AdminSyncSection = ({ userId, onOpenCategories }: AdminSyncSectionProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastResult, setLastResult] = useState<SyncApiResult | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [lastSyncedCount, setLastSyncedCount] = useState<number | null>(null)
  const [historyItems, setHistoryItems] = useState<CatalogSyncHistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState<CatalogSyncProgress | null>(null)

  const hydrateSummaryFromHistory = (items: CatalogSyncHistoryItem[]) => {
    const latest = items[0]
    if (!latest) {
      setLastSyncAt(null)
      setLastSyncedCount(null)
      setLastResult(null)
      return
    }
    setLastSyncAt(formatFinishedAt(latest.finishedAt))
    const lastSuccess = items.find((item) => item.status === 'success')
    if (lastSuccess) {
      setLastSyncedCount(lastSuccess.syncedProducts)
      setLastResult(historyToPartialResult(lastSuccess))
      setSyncStatus('success')
    } else {
      setLastSyncedCount(null)
      setLastResult(null)
      setSyncStatus('error')
    }
  }

  const loadPersistedState = useCallback(async () => {
    try {
      const [items, job] = await Promise.all([
        fetchCatalogSyncHistory(userId, 3),
        fetchCatalogSyncStatus(userId),
      ])
      setHistoryItems(items)

      if (job.status === 'running') {
        setSyncStatus('in-progress')
        setSyncProgress(job.progress)
        return
      }

      if (job.status === 'success' && job.result) {
        setSyncStatus('success')
        setLastResult(job.result)
        setLastSyncedCount(job.result.syncedProducts)
        if (job.finishedAt) {
          setLastSyncAt(formatFinishedAt(job.finishedAt))
        }
        return
      }

      if (job.status === 'error') {
        setSyncStatus('error')
        if (job.error) setError(job.error)
        if (job.finishedAt) {
          setLastSyncAt(formatFinishedAt(job.finishedAt))
        }
        if (items.length > 0) return
      }

      if (items.length > 0) {
        hydrateSummaryFromHistory(items)
      }
    } catch {
      // Non-blocking: section still allows manual sync
    }
  }, [userId])

  useEffect(() => {
    void loadPersistedState()
  }, [loadPersistedState])

  const refreshHistory = useCallback(async () => {
    const items = await fetchCatalogSyncHistory(userId, 3)
    setHistoryItems(items)
    return items
  }, [userId])

  const handleSync = async () => {
    setIsLoading(true)
    setSyncStatus('in-progress')
    setError(null)
    setSyncProgress({ phase: 'sheet', message: 'Запуск синхронизации…' })

    try {
      const syncData = await triggerCatalogSync(userId, setSyncProgress)
      const now = formatFinishedAt(new Date().toISOString())

      setLastResult(syncData)
      setLastSyncAt(now)
      setLastSyncedCount(syncData.syncedProducts)
      setSyncStatus('success')
      setSyncProgress({
        phase: 'done',
        message: `Готово: синхронизировано ${syncData.syncedProducts} товаров.`,
      })
      await refreshHistory()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка синхронизации'
      setSyncStatus('error')
      setError(message)
      setSyncProgress(null)
      try {
        await refreshHistory()
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-muru-olive">Синхронизация</h2>
        <p className="mt-1 text-sm text-[#5c5346]">
          Загрузка каталога из реестра и фото из Google Drive в базу приложения.
        </p>
      </div>

      <div className="grid gap-2 rounded-xl bg-[#efe8d8] p-3 text-sm">
        <p>
          <span className="font-medium">Статус синхронизации:</span>{' '}
          {syncStatus === 'idle'
            ? 'Ожидание запуска'
            : syncStatus === 'in-progress'
              ? 'Выполняется на сервере…'
              : syncStatus === 'success'
                ? 'Успешно'
                : syncStatus === 'error'
                  ? 'Ошибка'
                  : 'Ожидание запуска'}
        </p>
        <p>
          <span className="font-medium">Последний запуск:</span> {lastSyncAt ?? 'ещё не запускалась'}
        </p>
        <p>
          <span className="font-medium">Количество товаров:</span>{' '}
          {lastSyncedCount != null ? lastSyncedCount : '—'}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className={`${pressableDisabled} rounded-xl bg-muru-olive px-4 py-3 text-sm font-semibold text-muru-ivory sm:col-span-2`}
          disabled={isLoading}
          onClick={() => void handleSync()}
        >
          {isLoading ? 'Синхронизация…' : 'Синхронизировать каталог'}
        </button>
        <button
          type="button"
          className={`${pressableDisabled} rounded-xl bg-[#e3dccd] px-4 py-3 text-sm font-semibold`}
          disabled={isLoading}
          onClick={() => void loadPersistedState()}
        >
          Обновить
        </button>
        <button
          type="button"
          className={`${pressable} rounded-xl bg-[#efe8d8] px-4 py-3 text-sm font-medium`}
          onClick={onOpenCategories}
        >
          Категории — обложки из Drive
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {isLoading && syncProgress ? (
        <div className="rounded-lg border border-[#d8cfbc] bg-[#fff5df] px-3 py-2 text-sm text-[#5c5346]">
          <p className="font-medium text-muru-olive">Ход синхронизации</p>
          <p className="mt-1 flex items-center gap-2">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muru-olive border-t-transparent" />
            {syncProgress.message}
          </p>
        </div>
      ) : null}

      {lastResult ? (
        <div className="rounded-xl bg-[#efe8d8] p-3 text-sm">
          <h3 className="font-semibold text-muru-olive">Итог последней синхронизации</h3>
          {lastResult.sheetTitle ? (
            <p className="mt-1">
              Источник: <span className="font-medium">{lastResult.sheetTitle}</span>
            </p>
          ) : null}
          {formatDurationSec(lastResult.durationMs) ? (
            <p>Время: {formatDurationSec(lastResult.durationMs)}</p>
          ) : null}
          {typeof lastResult.driveFoldersScanned === 'number' ? (
            <p className="mt-1">
              Drive: папок {lastResult.driveFoldersScanned}, файлов {lastResult.driveImagesSeen ?? '—'},
              сопоставлено {lastResult.driveImagesMatched ?? '—'}, SKU с фото{' '}
              {lastResult.driveSkusWithImages ?? '—'}
            </p>
          ) : null}
          <p className="mt-1">Строк в таблице: {lastResult.totalRows}</p>
          <p>Синхронизировано: {lastResult.syncedProducts}</p>
          <p>Пропущено: {lastResult.skippedProducts}</p>
          {typeof lastResult.skippedByRule === 'number' ? (
            <p>Не MU (правило артикула): {lastResult.skippedByRule}</p>
          ) : null}
          {lastResult.errorGroups && lastResult.errorGroups.length > 0 ? (
            <div className="mt-2">
              <p className="font-medium text-muru-olive">Сводка ошибок</p>
              <ul className="mt-1 list-disc pl-5">
                {lastResult.errorGroups.map((group) => (
                  <li key={group.reason}>
                    {group.reason}: {group.count}
                    {group.sampleSkus.length > 0
                      ? ` (например: ${group.sampleSkus.join(', ')})`
                      : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : lastResult.errors.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {lastResult.errors.slice(0, 10).map((item) => (
                <li key={`${item.sku}-${item.reason}`}>
                  {item.sku}: {item.reason}
                </li>
              ))}
            </ul>
          ) : null}
          {lastResult.warnings && lastResult.warnings.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-amber-900">
              {lastResult.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl bg-[#efe8d8] p-3 text-sm">
        <h3 className="font-semibold text-muru-olive">Лог последних изменений</h3>
        {historyItems.length === 0 ? (
          <p className="mt-1">Лог пуст. Запустите синхронизацию.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {historyItems.map((entry) => (
              <li key={entry.id} className="rounded-lg bg-[#fff5df] px-2 py-1">
                {formatHistoryLine(entry)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
