import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ImageUploadField } from '../../components/content/ImageUploadField'
import { RichTextEditor } from '../../components/content/RichTextEditor'
import { SeoFields } from '../../components/content/SeoFields'
import { SkuListEditor } from '../../components/content/SkuListEditor'
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
  const confirm = useConfirm()
  const toast = useToast()
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

      toast.success('Сохранено')
      if (isNew) {
        navigate(`/catalog/sections/collections/${saved.id}`, { replace: true })
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
      title: 'Удалить коллекцию?',
      message: 'Запись будет удалена без возможности восстановления.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteCollection(id)
      toast.success('Коллекция удалена')
      navigate('/catalog/sections/collections')
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
        title={isNew ? 'Новая коллекция' : 'Редактирование коллекции'}
        backTo="/catalog/sections/collections"
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

          <Field label="Подзаголовок" htmlFor="subtitle">
            <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </Field>

          <Field label="Порядок сортировки" htmlFor="sortOrder">
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </Field>

          <ImageUploadField label="Обложка" value={heroImage} onChange={setHeroImage} />

          <Checkbox
            label="Видна на сайте"
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
          />
        </Card>

        <Card title="Описание">
          <RichTextEditor label="Описание" value={description} onChange={setDescription} />
        </Card>

        <Card title="Товары (SKU)">
          <SkuListEditor value={products} onChange={setProducts} />
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
