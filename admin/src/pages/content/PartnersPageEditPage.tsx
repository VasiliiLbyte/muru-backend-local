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
import { getPageBySlug, upsertPartnersPage } from '../../lib/content-api'
import {
  createDefaultPartnersSections,
  type PartnersSections,
} from '../../types/content'

const isPartnersSections = (value: unknown): value is PartnersSections => {
  if (!value || typeof value !== 'object') return false
  if ('hr' in value || 'mission' in value || 'vacancies' in value) return false
  return 'hero' in value
}

export const PartnersPageEditPage = () => {
  const toast = useToast()

  const [title, setTitle] = useState('Партнерам')
  const [sections, setSections] = useState<PartnersSections>(createDefaultPartnersSections())
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
        const page = await getPageBySlug('partners')
        setTitle(page.title || 'Партнерам')
        setSections(
          isPartnersSections(page.sections) ? page.sections : createDefaultPartnersSections(),
        )
        setSeoTitle(page.seoTitle)
        setSeoDescription(page.seoDescription)
        setIsVisible(page.isVisible)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setTitle('Партнерам')
          setSections(createDefaultPartnersSections())
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
  }, [])

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const saved = await upsertPartnersPage({
        title: title.trim() || 'Партнерам',
        seoTitle,
        seoDescription,
        isVisible,
        sections,
      })
      setTitle(saved.title)
      setSections(
        isPartnersSections(saved.sections) ? saved.sections : createDefaultPartnersSections(),
      )
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
      <PageHeader title="Партнёры" backTo="/content/company" backLabel="О нас" />

      <form className="form-stack" onSubmit={onSubmit}>
        <Card title="Карточка">
          <ImageUploadField
            label="Изображение"
            value={sections.hero.image}
            onChange={(image) =>
              setSections((prev) => ({ ...prev, hero: { ...prev.hero, image } }))
            }
          />
          <Field label="Заголовок в карточке" htmlFor="partners-hero-heading">
            <Input
              id="partners-hero-heading"
              value={sections.hero.heading}
              onChange={(e) =>
                setSections((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, heading: e.target.value },
                }))
              }
            />
          </Field>
          <RichTextEditor
            label="Текст в карточке"
            value={sections.hero.text}
            onChange={(text) =>
              setSections((prev) => ({ ...prev, hero: { ...prev.hero, text } }))
            }
          />
        </Card>

        <Card title="Основное">
          <Field label="Название страницы" htmlFor="partners-page-title">
            <Input
              id="partners-page-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>
          <p className="muted-text">В крошках и SEO (напр. Партнерам)</p>
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
