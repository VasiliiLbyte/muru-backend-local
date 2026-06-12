import { useCallback, useEffect, useState } from 'react'

import {
  fetchCatalogSyncHistory,
  fetchCatalogSyncStatus,
  fetchSyncSchedule,
  triggerCatalogSync,
  updateSyncSchedule,
  type CatalogSyncHistoryItem,
  type CatalogSyncProgress,
  type SyncApiResult,
  type SyncScheduleSettings,
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

const formatHistoryWho = (adminTelegramId: number): string =>
  adminTelegramId === 0 ? 'автоматически' : `админ ${adminTelegramId}`

const formatHistoryLine = (entry: CatalogSyncHistoryItem): string => {
  const when = formatFinishedAt(entry.finishedAt)
  const who = formatHistoryWho(entry.adminTelegramId)
  if (entry.status === 'success') {
    return `${when} — успешно — ${entry.syncedProducts} товаров — ${who}`
  }
  const err = entry.errorMessage ? ` — ${entry.errorMessage}` : ''
  return `${when} — ошибка — ${who}${err}`
}

const SYNC_HOUR_PRESETS: { hourMsk: number; label: string }[] = [
  { hourMsk: 2, label: '02:00' },
  { hourMsk: 4, label: '04:00' },
  { hourMsk: 6, label: '06:00' },
]

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
  const [schedule, setSchedule] = useState<SyncScheduleSettings | null>(null)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleHourMsk, setScheduleHourMsk] = useState(4)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleNote, setScheduleNote] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

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

  const loadSchedule = useCallback(async () => {
    try {
      const scheduleSettings = await fetchSyncSchedule(userId)
      setSchedule(scheduleSettings)
      setScheduleEnabled(scheduleSettings.enabled)
      setScheduleHourMsk(scheduleSettings.hourMsk)
      setScheduleError(null)
    } catch (e) {
      setSchedule(null)
      setScheduleError(
        e instanceof Error
          ? e.message
          : 'Не удалось загрузить настройки автосинхронизации. Перезагрузите backend (pm2 reload).',
      )
    }
  }, [userId])

  const loadPersistedState = useCallback(async () => {
    void loadSchedule()

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
  }, [userId, loadSchedule])

  useEffect(() => {
    void loadPersistedState()
  }, [loadPersistedState])

  const refreshHistory = useCallback(async () => {
    const items = await fetchCatalogSyncHistory(userId, 3)
    setHistoryItems(items)
    return items
  }, [userId])

  const handleSaveSchedule = async () => {
    setScheduleSaving(true)
    setScheduleError(null)
    setScheduleNote(null)
    try {
      const saved = await updateSyncSchedule(userId, {
        enabled: scheduleEnabled,
        hourMsk: scheduleHourMsk,
      })
      setSchedule(saved)
      setScheduleEnabled(saved.enabled)
      setScheduleHourMsk(saved.hourMsk)
      setScheduleNote('Сохранено.')
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : 'Не удалось сохранить настройки')
    } finally {
      setScheduleSaving(false)
    }
  }

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

      <div className="rounded-xl bg-[#efe8d8] p-3 text-sm">
        <h3 className="font-semibold text-muru-olive">Автосинхронизация</h3>
        <p className="mt-1 text-[#5c5346]">
          Каталог будет обновляться автоматически раз в сутки в выбранное время (МСК). При ошибке
          придёт уведомление в Telegram.
        </p>

        <button
          type="button"
          className={`${pressableDisabled} mt-3 flex w-full items-center gap-3 rounded-lg border border-[#d8cfbc] bg-white px-3 py-2.5 text-left`}
          disabled={scheduleSaving}
          onClick={() => setScheduleEnabled((v) => !v)}
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              scheduleEnabled
                ? 'border-muru-olive bg-muru-olive text-muru-ivory'
                : 'border-[#d8cfbc] bg-white'
            }`}
            aria-hidden
          >
            {scheduleEnabled ? '✓' : ''}
          </span>
          <span>Включить автосинхронизацию</span>
        </button>

        <div className="mt-3">
          <span className="text-xs font-medium text-[#5c5346]">Время запуска (МСК)</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SYNC_HOUR_PRESETS.map((preset) => (
              <button
                key={preset.hourMsk}
                type="button"
                className={`${pressable} rounded-lg px-3 py-1.5 text-xs font-medium ${
                  scheduleHourMsk === preset.hourMsk
                    ? 'bg-muru-olive text-muru-ivory'
                    : 'bg-white text-muru-olive'
                }`}
                disabled={scheduleSaving}
                onClick={() => setScheduleHourMsk(preset.hourMsk)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {schedule?.lastAutoRunAt ? (
          <p className="mt-2 text-xs text-[#7a7165]">
            Последний автозапуск: {formatFinishedAt(schedule.lastAutoRunAt)}
          </p>
        ) : null}

        {scheduleError ? <p className="mt-2 text-sm text-red-700">{scheduleError}</p> : null}
        {scheduleNote ? <p className="mt-2 text-sm text-muru-olive">{scheduleNote}</p> : null}

        <button
          type="button"
          className={`${pressableDisabled} mt-3 rounded-xl bg-muru-olive px-4 py-2 text-sm font-semibold text-muru-ivory`}
          disabled={scheduleSaving}
          onClick={() => void handleSaveSchedule()}
        >
          {scheduleSaving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>

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
          {typeof lastResult.deletedProducts === 'number' && lastResult.deletedProducts > 0 ? (
            <p>
              Удалено из каталога (нет в таблице): {lastResult.deletedProducts}
              {lastResult.deletedSkusSample && lastResult.deletedSkusSample.length > 0
                ? ` — ${lastResult.deletedSkusSample.join(', ')}${lastResult.deletedProducts > lastResult.deletedSkusSample.length ? '…' : ''}`
                : ''}
            </p>
          ) : null}
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
