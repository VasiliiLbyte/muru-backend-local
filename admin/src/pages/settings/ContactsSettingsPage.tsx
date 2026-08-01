import { useCallback, useEffect, useState } from 'react'

import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  SkeletonForm,
  useToast,
} from '../../components/ui'
import { ApiError } from '../../lib/api'
import { getSiteSettings, updateContactSettings } from '../../lib/settings-api'
import type { ContactSettingsInput, SiteSettingsDto } from '../../types/settings'

type FormState = {
  contactPhoneDisplay: string
  contactPhoneHref: string
  contactEmail: string
  contactAddress: string
  contactHours: string
  contactMapLat: string
  contactMapLng: string
  contactMapZoom: string
  socialTelegram: string
  socialWhatsapp: string
  socialVk: string
}

const emptyForm = (): FormState => ({
  contactPhoneDisplay: '',
  contactPhoneHref: '',
  contactEmail: '',
  contactAddress: '',
  contactHours: '',
  contactMapLat: '',
  contactMapLng: '',
  contactMapZoom: '',
  socialTelegram: '',
  socialWhatsapp: '',
  socialVk: '',
})

const nullToStr = (value: string | null | undefined): string => value ?? ''

const numToStr = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value)

const dtoToForm = (dto: SiteSettingsDto): FormState => ({
  contactPhoneDisplay: nullToStr(dto.contactPhoneDisplay),
  contactPhoneHref: nullToStr(dto.contactPhoneHref),
  contactEmail: nullToStr(dto.contactEmail),
  contactAddress: nullToStr(dto.contactAddress),
  contactHours: nullToStr(dto.contactHours),
  contactMapLat: numToStr(dto.contactMapLat),
  contactMapLng: numToStr(dto.contactMapLng),
  contactMapZoom: numToStr(dto.contactMapZoom),
  socialTelegram: nullToStr(dto.socialTelegram),
  socialWhatsapp: nullToStr(dto.socialWhatsapp),
  socialVk: nullToStr(dto.socialVk),
})

const emptyToNull = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

const parseOptionalNumber = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

const parseOptionalInt = (value: string): number | null => {
  const n = parseOptionalNumber(value)
  if (n === null) return null
  return Number.isInteger(n) ? n : Math.trunc(n)
}

/** Always send all 11 contact fields (backend nulls empty / omitted-equivalent). */
export const buildContactPayload = (form: FormState): ContactSettingsInput => ({
  contactPhoneDisplay: emptyToNull(form.contactPhoneDisplay),
  contactPhoneHref: emptyToNull(form.contactPhoneHref),
  contactEmail: emptyToNull(form.contactEmail),
  contactAddress: emptyToNull(form.contactAddress),
  contactHours: emptyToNull(form.contactHours),
  contactMapLat: parseOptionalNumber(form.contactMapLat),
  contactMapLng: parseOptionalNumber(form.contactMapLng),
  contactMapZoom: parseOptionalInt(form.contactMapZoom),
  socialTelegram: emptyToNull(form.socialTelegram),
  socialWhatsapp: emptyToNull(form.socialWhatsapp),
  socialVk: emptyToNull(form.socialVk),
})

export const ContactsSettingsPage = () => {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField =
    (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }))
    }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const settings = await getSiteSettings()
      setForm(dtoToForm(settings))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить настройки'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = buildContactPayload(form)
      const saved = await updateContactSettings(payload)
      setForm(dtoToForm(saved))
      toast.success('Сохранено')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось сохранить'
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
      <PageHeader title="Контакты" />

      <form className="form-stack" onSubmit={onSubmit}>
        <Card title="Контакты">
          <p className="muted-text">Телефон, email, адрес и режим работы на витрине.</p>

          <Field label="Телефон (отображение)" htmlFor="contact-phone-display">
            <Input
              id="contact-phone-display"
              value={form.contactPhoneDisplay}
              onChange={setField('contactPhoneDisplay')}
              placeholder="+7 (999) 000-00-00"
            />
          </Field>

          <Field label="Телефон (ссылка tel:)" htmlFor="contact-phone-href">
            <Input
              id="contact-phone-href"
              value={form.contactPhoneHref}
              onChange={setField('contactPhoneHref')}
              placeholder="tel:+79990000000"
            />
          </Field>

          <Field label="Email" htmlFor="contact-email">
            <Input
              id="contact-email"
              type="email"
              value={form.contactEmail}
              onChange={setField('contactEmail')}
              placeholder="shop@example.com"
            />
          </Field>

          <Field label="Адрес" htmlFor="contact-address">
            <Input
              id="contact-address"
              value={form.contactAddress}
              onChange={setField('contactAddress')}
            />
          </Field>

          <Field label="Режим работы" htmlFor="contact-hours">
            <Input
              id="contact-hours"
              value={form.contactHours}
              onChange={setField('contactHours')}
              placeholder="Пн–Пт 10:00–19:00"
            />
          </Field>
        </Card>

        <Card title="Карта">
          <Field label="Широта (lat)" htmlFor="contact-map-lat">
            <Input
              id="contact-map-lat"
              inputMode="decimal"
              value={form.contactMapLat}
              onChange={setField('contactMapLat')}
              placeholder="55.75"
            />
          </Field>

          <Field label="Долгота (lng)" htmlFor="contact-map-lng">
            <Input
              id="contact-map-lng"
              inputMode="decimal"
              value={form.contactMapLng}
              onChange={setField('contactMapLng')}
              placeholder="37.62"
            />
          </Field>

          <Field label="Масштаб (zoom)" htmlFor="contact-map-zoom">
            <Input
              id="contact-map-zoom"
              inputMode="numeric"
              value={form.contactMapZoom}
              onChange={setField('contactMapZoom')}
              placeholder="14"
            />
          </Field>
        </Card>

        <Card title="Соцсети">
          <p className="muted-text">Пустые ссылки на витрине не показываются.</p>

          <Field label="Telegram" htmlFor="social-telegram">
            <Input
              id="social-telegram"
              value={form.socialTelegram}
              onChange={setField('socialTelegram')}
              placeholder="https://t.me/…"
            />
          </Field>

          <Field label="WhatsApp" htmlFor="social-whatsapp">
            <Input
              id="social-whatsapp"
              value={form.socialWhatsapp}
              onChange={setField('socialWhatsapp')}
              placeholder="https://wa.me/…"
            />
          </Field>

          <Field label="ВКонтакте" htmlFor="social-vk">
            <Input
              id="social-vk"
              value={form.socialVk}
              onChange={setField('socialVk')}
              placeholder="https://vk.com/…"
            />
          </Field>
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
