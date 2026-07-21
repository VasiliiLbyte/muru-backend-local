import { useEffect, useState } from 'react'

import { ImageUploadField } from '../../components/content/ImageUploadField'
import { RichTextEditor } from '../../components/content/RichTextEditor'
import { SeoFields } from '../../components/content/SeoFields'
import { VacancyItemsEditor } from '../../components/content/VacancyItemsEditor'
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
import { getPageBySlug, upsertVacancyPage } from '../../lib/content-api'
import {
  createDefaultVacancySections,
  type VacancySections,
} from '../../types/content'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9+\s()\-]+$/

const isVacancySections = (value: unknown): value is VacancySections =>
  Boolean(value && typeof value === 'object' && 'hr' in value && 'vacancies' in value)

export const VacancyPageEditPage = () => {
  const toast = useToast()

  const [title, setTitle] = useState('Вакансии')
  const [sections, setSections] = useState<VacancySections>(createDefaultVacancySections())
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
        const page = await getPageBySlug('vacancy')
        setTitle(page.title || 'Вакансии')
        setSections(
          isVacancySections(page.sections) ? page.sections : createDefaultVacancySections(),
        )
        setSeoTitle(page.seoTitle)
        setSeoDescription(page.seoDescription)
        setIsVisible(page.isVisible)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setTitle('Вакансии')
          setSections(createDefaultVacancySections())
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

    const email = sections.hr.email.trim()
    const phone = sections.hr.phone.trim()
    if (email && !EMAIL_RE.test(email)) {
      const message = 'Некорректный email HR'
      setError(message)
      toast.error(message)
      setSaving(false)
      return
    }
    if (phone && !PHONE_RE.test(phone)) {
      const message = 'Некорректный телефон HR'
      setError(message)
      toast.error(message)
      setSaving(false)
      return
    }

    try {
      const saved = await upsertVacancyPage({
        title: title.trim() || 'Вакансии',
        seoTitle,
        seoDescription,
        isVisible,
        sections,
      })
      setTitle(saved.title)
      setSections(
        isVacancySections(saved.sections) ? saved.sections : createDefaultVacancySections(),
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
      <PageHeader title="Вакансии" backTo="/content/company" backLabel="О нас" />

      <form className="form-stack" onSubmit={onSubmit}>
        <Card title="Hero">
          <ImageUploadField
            label="Изображение"
            value={sections.hero.image}
            onChange={(image) =>
              setSections((prev) => ({ ...prev, hero: { ...prev.hero, image } }))
            }
          />
          <Field label="Заголовок" htmlFor="vacancy-hero-heading">
            <Input
              id="vacancy-hero-heading"
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
            label="Текст"
            value={sections.hero.text}
            onChange={(text) =>
              setSections((prev) => ({ ...prev, hero: { ...prev.hero, text } }))
            }
          />
        </Card>

        <Card title="Контакты HR">
          <p className="muted-text">
            Кнопка «Отправить резюме» на витрине откроет mailto по полю email.
          </p>
          <Field label="Заголовок" htmlFor="vacancy-hr-heading">
            <Input
              id="vacancy-hr-heading"
              value={sections.hr.heading}
              onChange={(e) =>
                setSections((prev) => ({
                  ...prev,
                  hr: { ...prev.hr, heading: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Имя контакта" htmlFor="vacancy-hr-name">
            <Input
              id="vacancy-hr-name"
              value={sections.hr.contactName}
              onChange={(e) =>
                setSections((prev) => ({
                  ...prev,
                  hr: { ...prev.hr, contactName: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Телефон" htmlFor="vacancy-hr-phone">
            <Input
              id="vacancy-hr-phone"
              value={sections.hr.phone}
              onChange={(e) =>
                setSections((prev) => ({
                  ...prev,
                  hr: { ...prev.hr, phone: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Email" htmlFor="vacancy-hr-email">
            <Input
              id="vacancy-hr-email"
              type="email"
              value={sections.hr.email}
              onChange={(e) =>
                setSections((prev) => ({
                  ...prev,
                  hr: { ...prev.hr, email: e.target.value },
                }))
              }
            />
          </Field>
        </Card>

        <Card title="Вакансии">
          <Field label="Заголовок блока" htmlFor="vacancy-list-heading">
            <Input
              id="vacancy-list-heading"
              value={sections.vacancies.heading}
              onChange={(e) =>
                setSections((prev) => ({
                  ...prev,
                  vacancies: { ...prev.vacancies, heading: e.target.value },
                }))
              }
            />
          </Field>
          <VacancyItemsEditor
            value={sections.vacancies.items}
            onChange={(items) =>
              setSections((prev) => ({
                ...prev,
                vacancies: { ...prev.vacancies, items },
              }))
            }
          />
        </Card>

        <Card title="Основное">
          <Field label="Название страницы" htmlFor="vacancy-page-title">
            <Input
              id="vacancy-page-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>
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
