import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ImageUploadField } from '../../components/content/ImageUploadField'
import { RichTextEditor } from '../../components/content/RichTextEditor'
import { SeoFields } from '../../components/content/SeoFields'
import { SkuListEditor } from '../../components/content/SkuListEditor'
import {
  createCollection,
  deleteCollection,
  getCollection,
  setCollectionProducts,
  updateCollection,
} from '../../lib/content-api'
import type { CollectionProductInput, ContentImage } from '../../types/content'
import { slugifyTitle } from '../../utils/slug'

export const CollectionEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [heroImage, setHeroImage] = useState<ContentImage | null>(null)
  const [products, setProducts] = useState<CollectionProductInput[]>([])
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
        const item = await getCollection(id)
        setSlug(item.slug)
        setSlugTouched(true)
        setTitle(item.title)
        setSubtitle(item.subtitle ?? '')
        setDescription(item.description ?? '')
        setHeroImage(item.heroImage)
        setProducts(item.productSlugs.map((sku, index) => ({ sku, sortOrder: index })))
        setSeoTitle(item.seoTitle)
        setSeoDescription(item.seoDescription)
        setIsVisible(item.isVisible)
        setSortOrder(item.sortOrder)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить коллекцию')
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
      subtitle: subtitle || null,
      description: description || null,
      heroImage,
      seoTitle,
      seoDescription,
      isVisible,
      sortOrder,
    }

    try {
      const saved = isNew
        ? await createCollection(payload)
        : await updateCollection(id!, payload)

      const normalizedProducts = products
        .map((p, index) => ({ sku: p.sku.trim().toUpperCase(), sortOrder: index }))
        .filter((p) => p.sku.length > 0)

      await setCollectionProducts(saved.id, normalizedProducts)

      if (isNew) {
        navigate(`/content/collections/${saved.id}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!id || isNew) return
    if (!window.confirm('Удалить коллекцию?')) return
    try {
      await deleteCollection(id)
      navigate('/content/collections')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
    }
  }

  if (loading) return <p className="muted-text">Загрузка...</p>

  return (
    <section className="content-form">
      <div className="content-form-header">
        <h3>{isNew ? 'Новая коллекция' : 'Редактирование коллекции'}</h3>
        <Link className="link-button" to="/content/collections">
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

        <label className="field-label" htmlFor="subtitle">
          Подзаголовок
        </label>
        <input
          id="subtitle"
          className="field-input"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
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

        <ImageUploadField label="Обложка" value={heroImage} onChange={setHeroImage} />

        <RichTextEditor label="Описание" value={description} onChange={setDescription} />

        <SkuListEditor value={products} onChange={setProducts} />

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
          Видна на сайте
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
