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
    <section className="page-card">
      <h1>Админ-панель</h1>
      <p>Синхронизация каталога из Google Sheets + Google Drive.</p>

      <div className="admin-actions">
        <button type="button" className="primary-btn" disabled={isLoading} onClick={handleSync}>
          {isLoading ? 'Синхронизация...' : 'Синхронизировать каталог'}
        </button>
        <button type="button" className="secondary-btn" onClick={onBack}>
          Назад в профиль
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      {result ? (
        <div className="admin-result">
          <p>Всего строк: {result.totalRows}</p>
          <p>Синхронизировано: {result.syncedProducts}</p>
          <p>Пропущено: {result.skippedProducts}</p>
          {result.errors.length > 0 ? (
            <ul className="admin-errors-list">
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
