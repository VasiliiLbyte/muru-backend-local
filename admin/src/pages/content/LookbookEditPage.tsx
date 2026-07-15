import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ImageUploadField } from '../../components/content/ImageUploadField'
import { HotspotEditor } from '../../components/inspiration/HotspotEditor'
import { RichTextEditor } from '../../components/content/RichTextEditor'
import { SeoFields } from '../../components/content/SeoFields'
import { createLookbook, deleteLookbook, getLookbook, updateLookbook } from '../../lib/content-api'
import type { ContentImage } from '../../types/content'
import { slugifyTitle } from '../../utils/slug'

export const LookbookEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImage, setCoverImage] = useState<ContentImage | null>(null)
  const [bannerImage, setBannerImage] = useState<ContentImage | null>(null)
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [isVisible, setIsVisible] = useState(true)
  const [sortOrder, setSortOrder] = useState(0)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isNew || !id) return

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const item = await getLookbook(id)
        setSlug(item.slug)
        setSlugTouched(true)
        setTitle(item.title)
        setDescription(item.description ?? '')
        setCoverImage(item.coverImage)
        setBannerImage(item.bannerImage)
        setSeoTitle(item.seoTitle)
        setSeoDescription(item.seoDescription)
        setIsVisible(item.isVisible)
        setSortOrder(item.sortOrder)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить лукбук')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, isNew])

  useEffect(() => {
    if (!slugTouched && isNew) {
      setSlug(slugifyTitle(title))
    }
  }, [title, slugTouched, isNew])

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      slug,
      title,
      description: description || null,
      coverImage,
      bannerImage,
      seoTitle,
      seoDescription,
      isVisible,
      sortOrder,
    }

    try {
      const saved = isNew ? await createLookbook(payload) : await updateLookbook(id!, payload)

      if (isNew) {
        navigate(`/catalog/sections/inspiration/${saved.id}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!id || isNew) return
    if (!window.confirm('Удалить лукбук?')) return
    try {
      await deleteLookbook(id)
      navigate('/catalog/sections/inspiration')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
    }
  }

  if (loading) return <p className="muted-text">Загрузка...</p>

  return (
    <section className="content-form">
      <div className="content-form-header">
        <h3>{isNew ? 'Новый лукбук' : 'Редактирование лукбука'}</h3>
        <Link className="link-button" to="/catalog/sections/inspiration">
          ← К списку
        </Link>
      </div>

      <form className="form-grid" onSubmit={onSubmit}>
        <label className="field-label" htmlFor="title">
          Название
        </label>
        <input
          id="title"
          className="field-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <label className="field-label" htmlFor="slug">
          Slug
        </label>
        <input
          id="slug"
          className="field-input"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true)
            setSlug(e.target.value)
          }}
          required
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

        <ImageUploadField label="Обложка" value={coverImage} onChange={setCoverImage} />
        <ImageUploadField label="Баннер" value={bannerImage} onChange={setBannerImage} />

        {!isNew && id && bannerImage ? (
          <fieldset className="form-section">
            <legend className="form-section-title">Точки на баннере</legend>
            <HotspotEditor lookbookId={id} bannerImage={bannerImage} />
          </fieldset>
        ) : !isNew && !bannerImage ? (
          <p className="muted-text">Загрузите баннер для расстановки точек</p>
        ) : null}

        <RichTextEditor label="Описание" value={description} onChange={setDescription} />

        <SeoFields
          seoTitle={seoTitle}
          seoDescription={seoDescription}
          onSeoTitleChange={setSeoTitle}
          onSeoDescriptionChange={setSeoDescription}
        />

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
          />
          Виден на сайте
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
