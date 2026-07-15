import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { RichTextEditor } from '../../components/content/RichTextEditor'
import { SeoFields } from '../../components/content/SeoFields'
import {
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  PageHeader,
  SkeletonForm,
  useConfirm,
  useToast,
} from '../../components/ui'
import { createPage, deletePage, getPage, updatePage } from '../../lib/content-api'
import { slugifyTitle } from '../../utils/slug'

export const PageEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
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
        toast.success('Сохранено')
        navigate(`/content/pages/${created.id}`, { replace: true })
      } else if (id) {
        await updatePage(id, payload)
        toast.success('Сохранено')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!id || isNew) return
    const ok = await confirm({
      title: 'Удалить страницу?',
      message: 'Запись будет удалена без возможности восстановления.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deletePage(id)
      toast.success('Страница удалена')
      navigate('/content/pages')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить'
      setError(message)
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <section className="page-stack">
        <SkeletonForm />
      </section>
    )
  }

  return (
    <section className="page-stack">
      <PageHeader
        title={isNew ? 'Новая страница' : 'Редактирование страницы'}
        backTo="/content/pages"
        backLabel="К списку"
        actions={
          !isNew ? (
            <Button type="button" variant="danger" onClick={() => void onDelete()}>
              Удалить
            </Button>
          ) : undefined
        }
      />

      <form className="form-stack" onSubmit={onSubmit}>
        <Card title="Основное">
          <Field label="Название" htmlFor="title">
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>

          <Field label="Slug" htmlFor="slug">
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
              required
            />
          </Field>

          <RichTextEditor label="Текст (HTML)" value={bodyHtml} onChange={setBodyHtml} />

          <Checkbox
            label="Видна на сайте"
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
          />
        </Card>

        <Card title="SEO">
          <SeoFields
            seoTitle={seoTitle}
            seoDescription={seoDescription}
            onSeoTitleChange={setSeoTitle}
            onSeoDescriptionChange={setSeoDescription}
          />
        </Card>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="form-actions">
          <Button type="submit" loading={saving}>
            Сохранить
          </Button>
        </div>
      </form>
    </section>
  )
}
