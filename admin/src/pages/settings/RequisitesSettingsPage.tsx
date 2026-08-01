import { useCallback, useEffect, useState } from 'react'

import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  SkeletonForm,
  Textarea,
  useToast,
} from '../../components/ui'
import { ApiError } from '../../lib/api'
import { getSiteSettings, updateRequisitesSettings } from '../../lib/settings-api'
import type { RequisitesSettingsInput, SiteSettingsDto } from '../../types/settings'

type FormState = {
  reqFullName: string
  reqShortName: string
  reqInn: string
  reqOgrnip: string
  reqLegalAddress: string
  reqActualAddress: string
  reqPhone: string
  reqEmail: string
  reqSite: string
  reqBankDetails: string
}

const emptyForm = (): FormState => ({
  reqFullName: '',
  reqShortName: '',
  reqInn: '',
  reqOgrnip: '',
  reqLegalAddress: '',
  reqActualAddress: '',
  reqPhone: '',
  reqEmail: '',
  reqSite: '',
  reqBankDetails: '',
})

const nullToStr = (value: string | null | undefined): string => value ?? ''

const dtoToForm = (dto: SiteSettingsDto): FormState => ({
  reqFullName: nullToStr(dto.reqFullName),
  reqShortName: nullToStr(dto.reqShortName),
  reqInn: nullToStr(dto.reqInn),
  reqOgrnip: nullToStr(dto.reqOgrnip),
  reqLegalAddress: nullToStr(dto.reqLegalAddress),
  reqActualAddress: nullToStr(dto.reqActualAddress),
  reqPhone: nullToStr(dto.reqPhone),
  reqEmail: nullToStr(dto.reqEmail),
  reqSite: nullToStr(dto.reqSite),
  reqBankDetails: nullToStr(dto.reqBankDetails),
})

const emptyToNull = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

/** Always send all 10 requisites fields. */
export const buildRequisitesPayload = (form: FormState): RequisitesSettingsInput => ({
  reqFullName: emptyToNull(form.reqFullName),
  reqShortName: emptyToNull(form.reqShortName),
  reqInn: emptyToNull(form.reqInn),
  reqOgrnip: emptyToNull(form.reqOgrnip),
  reqLegalAddress: emptyToNull(form.reqLegalAddress),
  reqActualAddress: emptyToNull(form.reqActualAddress),
  reqPhone: emptyToNull(form.reqPhone),
  reqEmail: emptyToNull(form.reqEmail),
  reqSite: emptyToNull(form.reqSite),
  reqBankDetails: emptyToNull(form.reqBankDetails),
})

export const RequisitesSettingsPage = () => {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField =
    (key: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      const payload = buildRequisitesPayload(form)
      const saved = await updateRequisitesSettings(payload)
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
      <PageHeader title="Реквизиты" />

      <form className="form-stack" onSubmit={onSubmit}>
        <Card title="Организация">
          <p className="muted-text">Данные для страницы /company/requisites/ на витрине.</p>

          <Field label="Полное наименование" htmlFor="req-full-name">
            <Input
              id="req-full-name"
              value={form.reqFullName}
              onChange={setField('reqFullName')}
            />
          </Field>

          <Field label="Краткое наименование" htmlFor="req-short-name">
            <Input
              id="req-short-name"
              value={form.reqShortName}
              onChange={setField('reqShortName')}
            />
          </Field>

          <Field label="ИНН" htmlFor="req-inn">
            <Input id="req-inn" value={form.reqInn} onChange={setField('reqInn')} />
          </Field>

          <Field label="ОГРНИП" htmlFor="req-ogrnip">
            <Input id="req-ogrnip" value={form.reqOgrnip} onChange={setField('reqOgrnip')} />
          </Field>

          <Field label="Юридический адрес" htmlFor="req-legal-address">
            <Input
              id="req-legal-address"
              value={form.reqLegalAddress}
              onChange={setField('reqLegalAddress')}
            />
          </Field>

          <Field label="Фактический адрес" htmlFor="req-actual-address">
            <Input
              id="req-actual-address"
              value={form.reqActualAddress}
              onChange={setField('reqActualAddress')}
            />
          </Field>

          <Field label="Телефон" htmlFor="req-phone">
            <Input id="req-phone" value={form.reqPhone} onChange={setField('reqPhone')} />
          </Field>

          <Field label="Email" htmlFor="req-email">
            <Input
              id="req-email"
              type="email"
              value={form.reqEmail}
              onChange={setField('reqEmail')}
            />
          </Field>

          <Field label="Сайт" htmlFor="req-site">
            <Input id="req-site" value={form.reqSite} onChange={setField('reqSite')} />
          </Field>
        </Card>

        <Card title="Банк">
          <Field label="Банковские реквизиты" htmlFor="req-bank-details">
            <Textarea
              id="req-bank-details"
              rows={5}
              value={form.reqBankDetails}
              onChange={setField('reqBankDetails')}
              placeholder="Банк, БИК, р/с, к/с…"
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
