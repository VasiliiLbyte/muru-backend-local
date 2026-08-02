import { useCallback, useEffect, useState } from 'react'

import { ImageUploadField } from '../../components/content/ImageUploadField'
import { Button, PageHeader, SkeletonForm, useToast } from '../../components/ui'
import { ApiError } from '../../lib/api'
import { getSiteSettings, updateCatalogPlaceholderSettings } from '../../lib/settings-api'
import type { ContentImage } from '../../types/content'

const FALLBACK_HINT = '/uploads/catalog-placeholder.webp'

export const CatalogPlaceholderPage = () => {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [image, setImage] = useState<ContentImage | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const settings = await getSiteSettings()
      const url = settings.catalogPlaceholderImageUrl?.trim() || null
      setImage(url ? { url } : null)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось загрузить настройку'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async () => {
    setSaving(true)
    setError('')
    try {
      const result = await updateCatalogPlaceholderSettings({
        catalogPlaceholderImageUrl: image?.url?.trim() || null,
      })
      const url = result.catalogPlaceholderImageUrl?.trim() || null
      setImage(url ? { url } : null)
      toast.success('Плейсхолдер сохранён')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось сохранить'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="page-stack">
        <PageHeader title="Плейсхолдер каталога" />
        <SkeletonForm />
      </section>
    )
  }

  return (
    <section className="page-stack">
      <PageHeader title="Плейсхолдер каталога" />

      <p className="muted-text">
        Картинка для товаров без фото («Товар на фотосессии»). Очистка → fallback{' '}
        <code>{FALLBACK_HINT}</code>.
      </p>

      {image?.url ? (
        <div>
          <p className="muted-text">Текущий URL</p>
          <img
            src={image.url}
            alt="Плейсхолдер каталога"
            style={{ maxWidth: 320, width: '100%', height: 'auto', display: 'block' }}
          />
          <p className="muted-text" style={{ wordBreak: 'break-all' }}>
            {image.url}
          </p>
        </div>
      ) : (
        <p className="muted-text">Сейчас используется fallback (URL в настройках пуст).</p>
      )}

      <ImageUploadField label="Изображение плейсхолдера" value={image} onChange={setImage} />

      {error ? <p className="error-text">{error}</p> : null}

      <div className="form-actions">
        <Button type="button" onClick={() => void onSave()} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving || !image}
          onClick={() => setImage(null)}
        >
          Очистить
        </Button>
      </div>
    </section>
  )
}
