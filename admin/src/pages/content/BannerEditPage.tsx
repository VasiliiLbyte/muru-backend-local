import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ImageUploadField } from '../../components/content/ImageUploadField'
import { createBanner, deleteBanner, getBanner, updateBanner } from '../../lib/content-api'
import type { ContentImage } from '../../types/content'
import { datetimeLocalToIso, isoToDatetimeLocal } from '../../utils/datetime'

export const BannerEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [href, setHref] = useState('')
  const [image, setImage] = useState<ContentImage | null>(null)
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isNew || !id) return

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const item = await getBanner(id)
        setTitle(item.title)
        setSubtitle(item.subtitle ?? '')
        setHref(item.href ?? '')
        setImage(item.image)
        setSortOrder(item.sortOrder)
        setIsActive(item.isActive)
        setStartsAt(isoToDatetimeLocal(item.startsAt))
        setEndsAt(isoToDatetimeLocal(item.endsAt))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить баннер')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, isNew])

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      title,
      subtitle: subtitle || null,
      href: href || null,
      image,
      sortOrder,
      isActive,
      startsAt: datetimeLocalToIso(startsAt),
      endsAt: datetimeLocalToIso(endsAt),
    }

    try {
      if (isNew) {
        const created = await createBanner(payload)
        navigate(`/content/banners/${created.id}`, { replace: true })
      } else if (id) {
        await updateBanner(id, payload)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!id || isNew) return
    if (!window.confirm('Удалить баннер?')) return
    try {
      await deleteBanner(id)
      navigate('/content/banners')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
    }
  }

  if (loading) return <p className="muted-text">Загрузка...</p>

  return (
    <section className="content-form">
      <div className="content-form-header">
        <h3>{isNew ? 'Новый баннер' : 'Редактирование баннера'}</h3>
        <Link className="link-button" to="/content/banners">
          ← К списку
        </Link>
      </div>

      <form className="form-grid" onSubmit={onSubmit}>
        <label className="field-label" htmlFor="title">
          Заголовок
        </label>
        <input
          id="title"
          className="field-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <label className="field-label" htmlFor="subtitle">
          Подзаголовок
        </label>
        <input
          id="subtitle"
          className="field-input"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
        />

        <label className="field-label" htmlFor="href">
          Ссылка
        </label>
        <input
          id="href"
          className="field-input"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          placeholder="/catalog/..."
        />

        <label className="field-label" htmlFor="sortOrder">
          Порядок сортировки
        </label>
        <input
          id="sortOrder"
          className="field-input"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
        />

        <ImageUploadField label="Изображение" value={image} onChange={setImage} />

        <label className="field-label" htmlFor="startsAt">
          Начало показа
        </label>
        <input
          id="startsAt"
          className="field-input"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />

        <label className="field-label" htmlFor="endsAt">
          Конец показа
        </label>
        <input
          id="endsAt"
          className="field-input"
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Активен
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {!isNew ? (
            <button type="button" className="secondary-button" onClick={onDelete}>
              Удалить
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
