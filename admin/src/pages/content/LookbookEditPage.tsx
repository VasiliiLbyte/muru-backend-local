import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ImageUploadField } from '../../components/content/ImageUploadField'
import { HotspotEditor } from '../../components/inspiration/HotspotEditor'
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
import { createLookbook, deleteLookbook, getLookbook, updateLookbook } from '../../lib/content-api'
import type { ContentImage } from '../../types/content'
import { slugifyTitle } from '../../utils/slug'

export const LookbookEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
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
      toast.success('Сохранено')
      if (isNew) {
        navigate(`/catalog/sections/inspiration/${saved.id}`, { replace: true })
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
      title: 'Удалить лукбук?',
      message: 'Запись будет удалена без возможности восстановления.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteLookbook(id)
      toast.success('Лукбук удалён')
      navigate('/catalog/sections/inspiration')
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
        title={isNew ? 'Новый лукбук' : 'Редактирование лукбука'}
        backTo="/catalog/sections/inspiration"
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
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
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

          <Field label="Порядок сортировки" htmlFor="sortOrder">
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </Field>

          <ImageUploadField label="Обложка" value={coverImage} onChange={setCoverImage} />
          <ImageUploadField label="Баннер" value={bannerImage} onChange={setBannerImage} />

          <Checkbox
            label="Виден на сайте"
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
          />
        </Card>

        {!isNew && id && bannerImage ? (
          <Card title="Точки на баннере">
            <HotspotEditor lookbookId={id} bannerImage={bannerImage} />
          </Card>
        ) : !isNew && !bannerImage ? (
          <p className="muted-text">Загрузите баннер для расстановки точек</p>
        ) : null}

        <Card title="Описание">
          <RichTextEditor label="Описание" value={description} onChange={setDescription} />
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
