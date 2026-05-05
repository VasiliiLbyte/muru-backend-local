import { useState } from 'react'

import { triggerCatalogSync, type SyncApiResult } from '../lib/api'

type AdminPageProps = {
  userId?: number
  onBack: () => void
}

export const AdminPage = ({ userId, onBack }: AdminPageProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<SyncApiResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    if (!userId) {
      setError('Не удалось определить Telegram user ID')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const syncResult = await triggerCatalogSync(userId)
      setResult(syncResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка синхронизации')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
      <h1 className="text-xl font-semibold text-muru-olive">Админ-панель</h1>
      <p className="mt-2 text-sm">Синхронизация каталога из Google Sheets + Google Drive.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl bg-muru-olive px-4 py-2 text-sm font-medium text-muru-ivory"
          disabled={isLoading}
          onClick={handleSync}
        >
          {isLoading ? 'Синхронизация...' : 'Синхронизировать каталог'}
        </button>
        <button
          type="button"
          className="rounded-xl bg-[#efe8d8] px-4 py-2 text-sm font-medium"
          onClick={onBack}
        >
          Назад в профиль
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {result ? (
        <div className="mt-3 rounded-xl bg-[#efe8d8] p-3 text-sm">
          <p>Всего строк: {result.totalRows}</p>
          <p>Синхронизировано: {result.syncedProducts}</p>
          <p>Пропущено: {result.skippedProducts}</p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {result.errors.slice(0, 10).map((item) => (
                <li key={`${item.sku}-${item.reason}`}>
                  {item.sku}: {item.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
