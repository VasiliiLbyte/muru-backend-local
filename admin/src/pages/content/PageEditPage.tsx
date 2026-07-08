import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { RichTextEditor } from '../../components/content/RichTextEditor'
import { SeoFields } from '../../components/content/SeoFields'
import { createPage, deletePage, getPage, updatePage } from '../../lib/content-api'
import { slugifyTitle } from '../../utils/slug'

export const PageEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [isVisible, setIsVisible] = useState(true)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isNew || !id) return

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const page = await getPage(id)
        setSlug(page.slug)
        setSlugTouched(true)
        setTitle(page.title)
        setBodyHtml(page.bodyHtml)
        setSeoTitle(page.seoTitle)
        setSeoDescription(page.seoDescription)
        setIsVisible(page.isVisible)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить страницу')
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
      bodyHtml,
      seoTitle,
      seoDescription,
      isVisible,
    }

    try {
      if (isNew) {
        const created = await createPage(payload)
        navigate(`/content/pages/${created.id}`, { replace: true })
      } else if (id) {
        await updatePage(id, payload)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!id || isNew) return
    if (!window.confirm('Удалить страницу?')) return
    try {
      await deletePage(id)
      navigate('/content/pages')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
    }
  }

  if (loading) return <p className="muted-text">Загрузка...</p>

  return (
    <section className="content-form">
      <div className="content-form-header">
        <h3>{isNew ? 'Новая страница' : 'Редактирование страницы'}</h3>
        <Link className="link-button" to="/content/pages">
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

        <RichTextEditor label="Текст (HTML)" value={bodyHtml} onChange={setBodyHtml} />

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
