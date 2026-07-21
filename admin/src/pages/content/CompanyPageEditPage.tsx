import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

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
import { getPageBySlug, upsertCompanyPage } from '../../lib/content-api'
import {
  createDefaultCompanySections,
  type CompanyPromoCard,
  type CompanySections,
} from '../../types/content'

const PROMO_CARD_LINKS: Record<CompanyPromoCard['key'], string> = {
  vacancy: '/company/vacancy/',
  contacts: '/company/contacts/',
  partners: '/company/partners/',
}

export const CompanyPageEditPage = () => {
  const toast = useToast()

  const [title, setTitle] = useState('О нас')
  const [sections, setSections] = useState<CompanySections>(createDefaultCompanySections())
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
        const page = await getPageBySlug('company')
        setTitle(page.title || 'О нас')
        setSections(
          page.sections && 'promo' in page.sections
            ? page.sections
            : createDefaultCompanySections(),
        )
        setSeoTitle(page.seoTitle)
        setSeoDescription(page.seoDescription)
        setIsVisible(page.isVisible)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setTitle('О нас')
          setSections(createDefaultCompanySections())
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

  const updatePromoCard = (index: number, patch: Partial<CompanyPromoCard>) => {
    setSections((prev) => {
      const cards = [...prev.promo.cards] as CompanySections['promo']['cards']
      cards[index] = { ...cards[index], ...patch }
      return { ...prev, promo: { ...prev.promo, cards } }
    })
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const saved = await upsertCompanyPage({
        title: title.trim() || 'О нас',
        seoTitle,
        seoDescription,
        isVisible,
        sections,
      })
      setTitle(saved.title)
      setSections(
        saved.sections && 'promo' in saved.sections
          ? saved.sections
          : createDefaultCompanySections(),
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
      <PageHeader
        title="О нас"
        actions={
          <>
            <Link className="muru-btn muru-btn--secondary" to="/content/company/vacancy">
              Вакансии
            </Link>
            <Link className="muru-btn muru-btn--secondary" to="/content/company/partners">
              Стать партнёром
            </Link>
          </>
        }
      />

      <form className="form-stack" onSubmit={onSubmit}>
        <Card title="Hero">
          <ImageUploadField
            label="Изображение"
            value={sections.hero.image}
            onChange={(image) =>
              setSections((prev) => ({ ...prev, hero: { ...prev.hero, image } }))
            }
          />
          <Field label="Заголовок" htmlFor="company-hero-heading">
            <Input
              id="company-hero-heading"
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

        <Card title="Миссия">
          <Field label="Подпись" htmlFor="company-mission-label">
            <Input
              id="company-mission-label"
              value={sections.mission.label}
              onChange={(e) =>
                setSections((prev) => ({
                  ...prev,
                  mission: { ...prev.mission, label: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Заголовок" htmlFor="company-mission-heading">
            <Input
              id="company-mission-heading"
              value={sections.mission.heading}
              onChange={(e) =>
                setSections((prev) => ({
                  ...prev,
                  mission: { ...prev.mission, heading: e.target.value },
                }))
              }
            />
          </Field>
          <RichTextEditor
            label="Текст"
            value={sections.mission.text}
            onChange={(text) =>
              setSections((prev) => ({ ...prev, mission: { ...prev.mission, text } }))
            }
          />
          <ImageUploadField
            label="Изображение 1"
            value={sections.mission.images[0]}
            onChange={(image) =>
              setSections((prev) => {
                const images: CompanySections['mission']['images'] = [
                  image,
                  prev.mission.images[1],
                ]
                return { ...prev, mission: { ...prev.mission, images } }
              })
            }
          />
          <ImageUploadField
            label="Изображение 2"
            value={sections.mission.images[1]}
            onChange={(image) =>
              setSections((prev) => {
                const images: CompanySections['mission']['images'] = [
                  prev.mission.images[0],
                  image,
                ]
                return { ...prev, mission: { ...prev.mission, images } }
              })
            }
          />
        </Card>

        <Card title="Промо-блок">
          <ImageUploadField
            label="Фоновое изображение"
            value={sections.promo.image}
            onChange={(image) =>
              setSections((prev) => ({ ...prev, promo: { ...prev.promo, image } }))
            }
          />
          {sections.promo.cards.map((card, index) => (
            <div key={card.key} className="form-stack">
              <h4>{card.title || card.key}</h4>
              <Field label="Заголовок" htmlFor={`promo-card-${card.key}-title`}>
                <Input
                  id={`promo-card-${card.key}-title`}
                  value={card.title}
                  onChange={(e) => updatePromoCard(index, { title: e.target.value })}
                />
              </Field>
              <Field label="Текст" htmlFor={`promo-card-${card.key}-text`}>
                <Input
                  id={`promo-card-${card.key}-text`}
                  value={card.text}
                  onChange={(e) => updatePromoCard(index, { text: e.target.value })}
                />
              </Field>
              <p className="muted-text">
                Ссылка: <code>{PROMO_CARD_LINKS[card.key]}</code>
              </p>
            </div>
          ))}
        </Card>

        <Card title="Основное">
          <Field label="Название страницы" htmlFor="company-title">
            <Input
              id="company-title"
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
