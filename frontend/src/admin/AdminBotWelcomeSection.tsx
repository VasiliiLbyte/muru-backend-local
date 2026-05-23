import { useCallback, useEffect, useState } from 'react'

import { fetchBotWelcomeSettings, saveBotWelcomeSettings, type BotWelcomeSettings } from '../lib/api'
import { pressable, pressableDisabled } from '../lib/uiClasses'
import { SmartImage } from '../components/SmartImage'

type AdminBotWelcomeSectionProps = {
  userId: number
}

export const AdminBotWelcomeSection = ({ userId }: AdminBotWelcomeSectionProps) => {
  const [settings, setSettings] = useState<BotWelcomeSettings | null>(null)
  const [filenameDraft, setFilenameDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBotWelcomeSettings(userId)
      setSettings(data)
      setFilenameDraft(data.welcomeCoverDriveFilename ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить настройки бота')
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
    setNote(null)
    try {
      const res = await saveBotWelcomeSettings(userId, {
        welcomeCoverDriveFilename: filenameDraft.trim() ? filenameDraft.trim() : null,
      })
      setSettings(res.settings)
      setFilenameDraft(res.settings.welcomeCoverDriveFilename ?? '')
      const parts = ['Сохранено.']
      if (res.resolveWarning) parts.push(res.resolveWarning)
      setNote(parts.join(' '))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muru-olive/80">Загрузка…</p>
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-muru-olive">Telegram-бот — приветствие</h2>
      <p className="text-sm text-muru-olive/80">
        Картинка после /start: укажите имя файла из папки Google Drive (корень или вложенные папки в{' '}
        <code className="text-xs">GOOGLE_DRIVE_FOLDER_ID</code>), как для обложек категорий. Текст и кнопки
        меню задаются в <code className="text-xs">.env</code> на сервере.
      </p>

      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {note ? <div className="rounded-xl bg-[#efe8d8] p-3 text-sm text-muru-olive">{note}</div> : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium text-muru-olive">Имя файла на Drive</span>
        <input
          type="text"
          className="w-full rounded-lg border border-muru-olive/20 bg-white px-3 py-2 text-sm"
          value={filenameDraft}
          onChange={(e) => setFilenameDraft(e.target.value)}
          placeholder="welcome.webp"
          disabled={busy}
        />
      </label>

      {settings?.welcomeImageUrl ? (
        <div className="space-y-1">
          <span className="text-sm font-medium text-muru-olive">Превью</span>
          <SmartImage
            src={settings.welcomeImageUrl}
            alt="Приветствие бота"
            className="max-h-48 w-full rounded-xl object-cover"
          />
        </div>
      ) : (
        <p className="text-sm text-muru-olive/70">URL картинки появится после сохранения и успешного поиска файла в Drive.</p>
      )}

      <button
        type="button"
        className={busy ? pressableDisabled : pressable}
        disabled={busy}
        onClick={() => void handleSave()}
      >
        {busy ? 'Сохранение…' : 'Сохранить'}
      </button>
    </div>
  )
}
