import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ImageUploadField } from '../../components/content/ImageUploadField'
import { HotspotEditor } from '../../components/inspiration/HotspotEditor'
import { RichTextEditor } from '../../components/content/RichTextEditor'
import { SeoFields } from '../../components/content/SeoFields'
import {
  createLookbook,
  deleteLookbook,
  getLookbook,
  setLookbookImages,
  updateLookbook,
  uploadImage,
} from '../../lib/content-api'
import type { ContentImage, LookbookImageInput } from '../../types/content'
import { slugifyTitle } from '../../utils/slug'

export const LookbookEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImage, setCoverImage] = useState<ContentImage | null>(null)
  const [gallery, setGallery] = useState<LookbookImageInput[]>([])
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [isVisible, setIsVisible] = useState(true)
  const [sortOrder, setSortOrder] = useState(0)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
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
        setGallery(item.images.map((image, index) => ({ image, sortOrder: index })))
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

  const normalizeGallery = (items: LookbookImageInput[]) =>
    items.map((item, index) => ({ ...item, sortOrder: index }))

  const onGalleryFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploadingGallery(true)
    setError('')

    try {
      const uploaded: LookbookImageInput[] = []
      for (const file of Array.from(files)) {
        const image = await uploadImage(file)
        uploaded.push({ image, sortOrder: 0 })
      }
      setGallery((prev) => normalizeGallery([...prev, ...uploaded]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить изображения')
    } finally {
      setUploadingGallery(false)
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }

  const moveGalleryItem = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= gallery.length) return
    const next = [...gallery]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setGallery(normalizeGallery(next))
  }

  const removeGalleryItem = (index: number) => {
    setGallery(normalizeGallery(gallery.filter((_, i) => i !== index)))
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      slug,
      title,
      description: description || null,
      coverImage,
      seoTitle,
      seoDescription,
      isVisible,
      sortOrder,
    }

    try {
      const saved = isNew ? await createLookbook(payload) : await updateLookbook(id!, payload)
      await setLookbookImages(saved.id, normalizeGallery(gallery))

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

        {!isNew && id && coverImage ? (
          <fieldset className="form-section">
            <legend className="form-section-title">Точки на баннере</legend>
            <HotspotEditor lookbookId={id} coverImage={coverImage} />
          </fieldset>
        ) : !isNew && !coverImage ? (
          <p className="muted-text">Загрузите обложку для расстановки точек</p>
        ) : null}

        <RichTextEditor label="Описание" value={description} onChange={setDescription} />

        <fieldset className="form-section">
          <legend className="form-section-title">Галерея</legend>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={onGalleryFiles}
            disabled={uploadingGallery}
          />
          {uploadingGallery ? <p className="muted-text">Загрузка...</p> : null}
          <div className="gallery-list">
            {gallery.map((item, index) => (
              <div className="gallery-row" key={`${item.image.url}-${index}`}>
                <img src={item.image.url} alt={item.image.alt ?? ''} className="gallery-thumb" />
                <span className="muted-text">{item.image.url}</span>
                <div className="sku-row-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => moveGalleryItem(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => moveGalleryItem(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => removeGalleryItem(index)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </fieldset>

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
