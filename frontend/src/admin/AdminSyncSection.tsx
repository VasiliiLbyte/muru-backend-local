import { useMemo, useState } from 'react'

import {
  triggerCatalogSync,
  type CatalogSyncProgress,
  type SyncApiResult,
} from '../lib/api'
import { pressable, pressableDisabled } from '../lib/uiClasses'

type AdminSyncSectionProps = {
  userId: number
  onOpenCategories: () => void
}

type SyncStatus = 'idle' | 'in-progress' | 'success' | 'error'

type SyncLogEntry = {
  timestamp: string
  status: Exclude<SyncStatus, 'idle' | 'in-progress'>
  result?: SyncApiResult
  error?: string
}

const formatDurationSec = (durationMs?: number) =>
  durationMs != null ? `${Math.round(durationMs / 1000)} с` : null

const formatSyncLogLine = (result: SyncApiResult): string => {
  const parts = [
    `${result.syncedProducts} товаров`,
    `пропущено ${result.skippedProducts}`,
  ]
  const warnCount = result.warnings?.length ?? 0
  if (warnCount > 0) parts.push(`предупреждений ${warnCount}`)
  const errTotal =
    result.errorGroups?.reduce((sum, g) => sum + g.count, 0) ?? result.errors.length
  if (errTotal > 0) parts.push(`ошибок ${errTotal}`)
  const dur = formatDurationSec(result.durationMs)
  if (dur) parts.push(dur)
  return parts.join(', ')
}

export const AdminSyncSection = ({ userId, onOpenCategories }: AdminSyncSectionProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastResult, setLastResult] = useState<SyncApiResult | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState<CatalogSyncProgress | null>(null)

  const totalCatalogItems = useMemo(() => {
    if (!lastResult) return 0
    return Math.max(lastResult.totalRows, lastResult.syncedProducts)
  }, [lastResult])

  const handleSync = async () => {
    setIsLoading(true)
    setSyncStatus('in-progress')
    setError(null)
    setSyncProgress({ phase: 'sheet', message: 'Запуск синхронизации…' })

    try {
      const syncData = await triggerCatalogSync(userId, setSyncProgress)
      const now = new Date().toLocaleString('ru-RU')

      setLastResult(syncData)
      setLastSyncAt(now)
      setSyncStatus('success')
      setSyncProgress({
        phase: 'done',
        message: `Готово: синхронизировано ${syncData.syncedProducts} товаров.`,
      })
      setSyncLogs((prev) => [
        {
          timestamp: now,
          status: 'success',
          result: syncData,
        },
        ...prev,
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка синхронизации'
      const now = new Date().toLocaleString('ru-RU')

      setSyncStatus('error')
      setError(message)
      setSyncProgress(null)
      setSyncLogs((prev) => [
        {
          timestamp: now,
          status: 'error',
          error: message,
        },
        ...prev,
      ])
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
                : 'Ошибка'}
        </p>
        <p>
          <span className="font-medium">Последний запуск:</span> {lastSyncAt ?? 'ещё не запускалась'}
        </p>
        <p>
          <span className="font-medium">Количество товаров:</span> {totalCatalogItems}
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
          onClick={() => void handleSync()}
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
        {syncLogs.length === 0 ? (
          <p className="mt-1">Лог пуст. Запустите синхронизацию.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {syncLogs.slice(0, 10).map((entry, index) => (
              <li key={`${entry.timestamp}-${index}`} className="rounded-lg bg-[#fff5df] px-2 py-1">
                {entry.timestamp} — {entry.status === 'success' ? 'успешно' : 'ошибка'}{' '}
                {entry.result ? `(${formatSyncLogLine(entry.result)})` : entry.error ? `(${entry.error})` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
