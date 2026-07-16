import { useEffect, useState } from 'react'

import { ImageUploadField } from '../../components/content/ImageUploadField'
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
  useToast,
} from '../../components/ui'
import { ApiError } from '../../lib/api'
import { getPageBySlug, upsertPageBySlug } from '../../lib/content-api'
import type { ContentImage } from '../../types/content'

export type FixedPageSection = 'help' | 'contacts'

const SECTION_META: Record<
  FixedPageSection,
  { title: string; hint: string; defaultTitle: string }
> = {
  help: {
    title: 'Клиентам',
    hint: 'Текст попадёт в блок на баннере',
    defaultTitle: 'Клиентам',
  },
  contacts: {
    title: 'Контакты',
    hint: 'Изображение над реквизитами на витрине',
    defaultTitle: 'Контакты',
  },
}

type FixedPageEditPageProps = {
  section: FixedPageSection
}

export const FixedPageEditPage = ({ section }: FixedPageEditPageProps) => {
  const toast = useToast()
  const meta = SECTION_META[section]

  const [title, setTitle] = useState(meta.defaultTitle)
  const [bodyHtml, setBodyHtml] = useState('')
  const [heroImage, setHeroImage] = useState<ContentImage | null>(null)
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [isVisible, setIsVisible] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const page = await getPageBySlug(section)
        setTitle(page.title || meta.defaultTitle)
        setBodyHtml(page.bodyHtml)
        setHeroImage(page.heroImage)
        setSeoTitle(page.seoTitle)
        setSeoDescription(page.seoDescription)
        setIsVisible(page.isVisible)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setTitle(meta.defaultTitle)
          setBodyHtml('')
          setHeroImage(null)
          setSeoTitle('')
          setSeoDescription('')
          setIsVisible(true)
        } else {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить страницу')
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [section, meta.defaultTitle])

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const saved = await upsertPageBySlug(section, {
        title: title.trim() || meta.defaultTitle,
        bodyHtml,
        heroImage,
        seoTitle,
        seoDescription,
        isVisible,
      })
      setTitle(saved.title)
      setBodyHtml(saved.bodyHtml)
      setHeroImage(saved.heroImage)
      setSeoTitle(saved.seoTitle)
      setSeoDescription(saved.seoDescription)
      setIsVisible(saved.isVisible)
      toast.success('Сохранено')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
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
      <PageHeader title={meta.title} />

      <form className="form-stack" onSubmit={onSubmit}>
        <Card title="Основное">
          <p className="muted-text">{meta.hint}</p>

          <Field label="Название" htmlFor={`${section}-title`}>
            <Input
              id={`${section}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>

          <ImageUploadField label="Изображение" value={heroImage} onChange={setHeroImage} />

          <RichTextEditor label="Текст" value={bodyHtml} onChange={setBodyHtml} />

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
