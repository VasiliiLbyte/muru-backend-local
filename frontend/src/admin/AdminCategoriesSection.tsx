import { useCallback, useEffect, useState } from 'react'

import {
  fetchAdminCategories,
  saveAdminCategoryCovers,
  triggerCategoryCoverSync,
  type AdminCategoryRow,
  type CategoryCoverSyncApiResult,
  type CategoryCoverSyncProgress,
} from '../lib/api'
import { pressable, pressableDisabled } from '../lib/uiClasses'
import { SmartImage } from '../components/SmartImage'

type AdminCategoriesSectionProps = {
  userId: number
  onBack?: () => void
}

export const AdminCategoriesSection = ({ userId, onBack }: AdminCategoriesSectionProps) => {
  const [rows, setRows] = useState<AdminCategoryRow[]>([])
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [syncingCovers, setSyncingCovers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<CategoryCoverSyncApiResult | null>(null)
  const [syncProgress, setSyncProgress] = useState<CategoryCoverSyncProgress | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminCategories(userId)
      setRows(data)
      const next: Record<number, string> = {}
      for (const r of data) {
        next[r.id] = r.coverDriveFilename ?? ''
      }
      setDrafts(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить категории')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    setSaveNote(null)
    try {
      const items = rows.map((r) => ({
        id: r.id,
        coverDriveFilename: drafts[r.id]?.trim() ? drafts[r.id].trim() : null,
      }))
      const res = await saveAdminCategoryCovers(userId, items)
      setSaveNote(
        res.validationErrors.length > 0
          ? `Сохранено строк: ${res.saved}. Ошибки: ${res.validationErrors.slice(0, 5).join('; ')}`
          : `Сохранено строк: ${res.saved}`,
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const handleSyncCovers = async () => {
    setBusy(true)
    setSyncingCovers(true)
    setError(null)
    setLastSync(null)
    setSyncProgress({ phase: 'lookup', message: 'Запуск синхронизации…' })
    try {
      const res = await triggerCategoryCoverSync(userId, setSyncProgress)
      setLastSync(res)
      setSyncProgress({ phase: 'done', message: `Готово: обновлено ${res.updated} обложек.` })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка синхронизации обложек')
      setSyncProgress(null)
    } finally {
      setBusy(false)
      setSyncingCovers(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-muru-olive">Категории — обложки из Drive</h2>
        {onBack ? (
          <button type="button" className={`${pressable} rounded-lg bg-[#efe8d8] px-3 py-1.5 text-sm`} onClick={onBack}>
            К обзору админки
          </button>
        ) : null}
      </div>
      <p className="text-xs text-[#5c5346]">
        Укажите <span className="font-medium">только имя файла</span> (например <code>MU0023_1_O.png</code>), не путь к
        папке. Сохраните, затем синхронизируйте. После синка каталога поиск обложек обычно занимает несколько секунд.
      </p>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {saveNote ? <p className="text-sm text-green-800">{saveNote}</p> : null}

      {syncingCovers && syncProgress ? (
        <div className="rounded-lg border border-[#d8cfbc] bg-[#fff5df] px-3 py-2 text-sm text-[#5c5346]">
          <p className="font-medium text-muru-olive">Ход синхронизации</p>
          <p className="mt-1 flex items-center gap-2">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muru-olive border-t-transparent" />
            {syncProgress.message}
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="h-24 animate-pulse rounded-lg bg-[#efe8d8]" />
      ) : (
        <div className="max-h-[55vh] overflow-auto rounded-lg border border-[#e3dccd]">
          <table className="w-full min-w-[280px] text-left text-xs sm:text-sm">
            <thead className="sticky top-0 bg-[#efe8d8]">
              <tr className="border-b border-[#d8cfbc]">
                <th className="px-2 py-2">Категория</th>
                <th className="px-2 py-2">Файл в Drive</th>
                <th className="px-2 py-2">Превью</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#efe8d8] last:border-b-0">
                  <td className="px-2 py-2 align-top">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-[11px] text-[#7a7165]">{row.slug}</div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      type="text"
                      className="w-full max-w-[10rem] rounded border border-[#d8cfbc] bg-white px-2 py-1 text-xs sm:max-w-[12rem]"
                      placeholder="cover.webp"
                      value={drafts[row.id] ?? ''}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    {row.coverImageUrl ? (
                      <SmartImage
                        src={row.coverImageUrl}
                        alt={row.name}
                        className="h-14 w-20 rounded-md object-cover bg-[#efe8d8]"
                      />
                    ) : (
                      <span className="text-[#9a9085]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${pressableDisabled} rounded-xl bg-muru-olive px-3 py-2 text-sm font-medium text-muru-ivory`}
          disabled={busy || loading}
          onClick={() => void handleSave()}
        >
          Сохранить имена файлов
        </button>
        <button
          type="button"
          className={`${pressableDisabled} rounded-xl bg-[#e3dccd] px-3 py-2 text-sm font-medium`}
          disabled={busy || loading}
          onClick={() => void handleSyncCovers()}
        >
          {syncingCovers ? 'Синхронизация… (1–5 мин)' : 'Синхронизировать картинки категорий'}
        </button>
        <button
          type="button"
          className={`${pressableDisabled} rounded-xl bg-[#efe8d8] px-3 py-2 text-sm`}
          disabled={busy || loading}
          onClick={() => void load()}
        >
          Обновить список
        </button>
      </div>

      {lastSync ? (
        <div className="rounded-lg bg-[#efe8d8] p-2 text-xs sm:text-sm">
          <p className="font-medium text-muru-olive">Итог синхронизации обложек</p>
          <p>Обновлено URL: {lastSync.updated}</p>
          <p>Пропущено: {lastSync.skipped}</p>
          {lastSync.errors.length > 0 ? (
            <ul className="mt-1 list-disc pl-4">
              {lastSync.errors.slice(0, 15).map((err) => (
                <li key={`${err.categoryId}-${err.reason}`}>
                  {err.slug}: {err.reason}
                </li>
              ))}
            </ul>
          ) : null}
          {lastSync.warnings && lastSync.warnings.length > 0 ? (
            <ul className="mt-1 list-disc pl-4 text-amber-900">
              {lastSync.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
