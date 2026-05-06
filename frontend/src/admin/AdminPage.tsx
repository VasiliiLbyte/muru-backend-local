import { useMemo, useState } from 'react'

import { triggerCatalogSync, type SyncApiResult } from '../lib/api'

type AdminPageProps = {
  userId?: number
  onBack: () => void
}

type SyncStatus = 'idle' | 'in-progress' | 'success' | 'error'

type SyncLogEntry = {
  timestamp: string
  status: Exclude<SyncStatus, 'idle' | 'in-progress'>
  result?: SyncApiResult
  error?: string
}

const mockOrders = [
  { id: '1001', date: '2026-05-05', status: 'Новый', amount: '12 400 ₽', client: 'Анна К.' },
  { id: '1002', date: '2026-05-05', status: 'В обработке', amount: '8 990 ₽', client: 'Илья С.' },
  { id: '1003', date: '2026-05-04', status: 'Доставлен', amount: '21 300 ₽', client: 'Мария П.' },
]

export const AdminPage = ({ userId, onBack }: AdminPageProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastResult, setLastResult] = useState<SyncApiResult | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const totalCatalogItems = useMemo(() => {
    if (!lastResult) return 0
    return Math.max(lastResult.totalRows, lastResult.syncedProducts)
  }, [lastResult])

  const handleSync = async () => {
    if (!userId) {
      setSyncStatus('error')
      setError('Не удалось определить Telegram user ID')
      return
    }

    setIsLoading(true)
    setSyncStatus('in-progress')
    setError(null)

    try {
      const syncData = await triggerCatalogSync(userId)
      const now = new Date().toLocaleString('ru-RU')

      setLastResult(syncData)
      setLastSyncAt(now)
      setSyncStatus('success')
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
    <section className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
      <h1 className="text-xl font-semibold text-muru-olive">Админ-панель</h1>
      <p className="mt-2 text-sm">Управление синхронизацией каталога и мониторинг изменений.</p>

      <div className="mt-4 grid gap-2 rounded-xl bg-[#efe8d8] p-3 text-sm">
        <p>
          <span className="font-medium">Статус синхронизации:</span>{' '}
          {syncStatus === 'idle'
            ? 'Ожидание запуска'
            : syncStatus === 'in-progress'
              ? 'Выполняется...'
              : syncStatus === 'success'
                ? 'Успешно'
                : 'Ошибка'}
        </p>
        <p>
          <span className="font-medium">Последний запуск:</span> {lastSyncAt ?? 'еще не запускалась'}
        </p>
        <p>
          <span className="font-medium">Количество товаров:</span> {totalCatalogItems}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="rounded-xl bg-muru-olive px-4 py-4 text-base font-semibold text-muru-ivory"
          disabled={isLoading}
          onClick={handleSync}
        >
          {isLoading ? 'Синхронизация...' : 'Синхронизировать каталог'}
        </button>
        <button
          type="button"
          className="rounded-xl bg-[#e3dccd] px-4 py-4 text-base font-semibold"
          disabled={isLoading}
          onClick={handleSync}
        >
          Обновить
        </button>
        <button
          type="button"
          className="rounded-xl bg-[#efe8d8] px-4 py-2 text-sm font-medium sm:col-span-2"
          onClick={onBack}
        >
          Назад в профиль
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {isLoading && !lastResult ? (
        <div className="mt-4 grid gap-2">
          <div className="h-20 animate-pulse rounded-xl bg-[#efe8d8]" />
          <div className="h-20 animate-pulse rounded-xl bg-[#efe8d8]" />
        </div>
      ) : null}

      {lastResult ? (
        <div className="mt-4 rounded-xl bg-[#efe8d8] p-3 text-sm">
          <h2 className="font-semibold text-muru-olive">Итог последней синхронизации</h2>
          <p className="mt-1">Всего строк: {lastResult.totalRows}</p>
          <p>Синхронизировано: {lastResult.syncedProducts}</p>
          <p>Пропущено: {lastResult.skippedProducts}</p>
          {lastResult.errors.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {lastResult.errors.slice(0, 10).map((item) => (
                <li key={`${item.sku}-${item.reason}`}>
                  {item.sku}: {item.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl bg-[#efe8d8] p-3 text-sm">
        <h2 className="font-semibold text-muru-olive">Лог последних изменений</h2>
        {syncLogs.length === 0 ? (
          <p className="mt-1 text-sm">Лог пуст. Запустите синхронизацию.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {syncLogs.slice(0, 10).map((entry, index) => (
              <li key={`${entry.timestamp}-${index}`} className="rounded-lg bg-[#fff5df] px-2 py-1">
                {entry.timestamp} - {entry.status === 'success' ? 'успешно' : 'ошибка'}{' '}
                {entry.result
                  ? `(обновлено: ${entry.result.syncedProducts}, ошибок: ${entry.result.errors.length})`
                  : entry.error
                    ? `(${entry.error})`
                    : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl bg-[#efe8d8] p-3">
        <h2 className="mb-2 text-sm font-semibold text-muru-olive">Список заказов (заглушка)</h2>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#d8cfbc]">
              <th className="px-2 py-1">№</th>
              <th className="px-2 py-1">Дата</th>
              <th className="px-2 py-1">Статус</th>
              <th className="px-2 py-1">Сумма</th>
              <th className="px-2 py-1">Клиент</th>
            </tr>
          </thead>
          <tbody>
            {mockOrders.map((order) => (
              <tr key={order.id} className="border-b border-[#e7decb] last:border-b-0">
                <td className="px-2 py-1">{order.id}</td>
                <td className="px-2 py-1">{order.date}</td>
                <td className="px-2 py-1">{order.status}</td>
                <td className="px-2 py-1">{order.amount}</td>
                <td className="px-2 py-1">{order.client}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
