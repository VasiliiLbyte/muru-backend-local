import { useCallback, useEffect, useState } from 'react'

import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonForm,
  useToast,
} from '../../components/ui'
import { ApiError } from '../../lib/api'
import {
  getIntegrationsStatus,
  getSiteSettings,
  updateCdekSettings,
} from '../../lib/settings-api'
import type {
  CdekSettingsInput,
  IntegrationsStatus,
  SiteSettingsDto,
} from '../../types/settings'

type FormState = {
  cdekEnv: '' | 'test' | 'production'
  cdekSenderCityCode: string
  cdekSenderPostalCode: string
  cdekSenderAddress: string
  cdekSenderName: string
  cdekSenderPhone: string
  cdekTariffDoor: string
  cdekTariffPvz: string
  cdekDefaultWeightGrams: string
  cdekDefaultLengthCm: string
  cdekDefaultWidthCm: string
  cdekDefaultHeightCm: string
}

const emptyForm = (): FormState => ({
  cdekEnv: '',
  cdekSenderCityCode: '',
  cdekSenderPostalCode: '',
  cdekSenderAddress: '',
  cdekSenderName: '',
  cdekSenderPhone: '',
  cdekTariffDoor: '',
  cdekTariffPvz: '',
  cdekDefaultWeightGrams: '',
  cdekDefaultLengthCm: '',
  cdekDefaultWidthCm: '',
  cdekDefaultHeightCm: '',
})

const nullToStr = (value: string | null | undefined): string => value ?? ''

const numToStr = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value)

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

const dtoToForm = (dto: SiteSettingsDto): FormState => ({
  cdekEnv: dto.cdekEnv === 'test' || dto.cdekEnv === 'production' ? dto.cdekEnv : '',
  cdekSenderCityCode: numToStr(dto.cdekSenderCityCode),
  cdekSenderPostalCode: nullToStr(dto.cdekSenderPostalCode),
  cdekSenderAddress: nullToStr(dto.cdekSenderAddress),
  cdekSenderName: nullToStr(dto.cdekSenderName),
  cdekSenderPhone: nullToStr(dto.cdekSenderPhone),
  cdekTariffDoor: numToStr(dto.cdekTariffDoor),
  cdekTariffPvz: numToStr(dto.cdekTariffPvz),
  cdekDefaultWeightGrams: numToStr(dto.cdekDefaultWeightGrams),
  cdekDefaultLengthCm: numToStr(dto.cdekDefaultLengthCm),
  cdekDefaultWidthCm: numToStr(dto.cdekDefaultWidthCm),
  cdekDefaultHeightCm: numToStr(dto.cdekDefaultHeightCm),
})

/** Always send full CDEK payload (empty → null = env fallback). */
export const buildCdekPayload = (form: FormState): CdekSettingsInput => ({
  cdekEnv: form.cdekEnv === '' ? null : form.cdekEnv,
  cdekSenderCityCode: parseOptionalInt(form.cdekSenderCityCode),
  cdekSenderPostalCode: emptyToNull(form.cdekSenderPostalCode),
  cdekSenderAddress: emptyToNull(form.cdekSenderAddress),
  cdekSenderName: emptyToNull(form.cdekSenderName),
  cdekSenderPhone: emptyToNull(form.cdekSenderPhone),
  cdekTariffDoor: parseOptionalInt(form.cdekTariffDoor),
  cdekTariffPvz: parseOptionalInt(form.cdekTariffPvz),
  cdekDefaultWeightGrams: parseOptionalInt(form.cdekDefaultWeightGrams),
  cdekDefaultLengthCm: parseOptionalInt(form.cdekDefaultLengthCm),
  cdekDefaultWidthCm: parseOptionalInt(form.cdekDefaultWidthCm),
  cdekDefaultHeightCm: parseOptionalInt(form.cdekDefaultHeightCm),
})

export const CdekSettingsPage = () => {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [status, setStatus] = useState<IntegrationsStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField =
    (key: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }))
    }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [settings, integrations] = await Promise.all([
        getSiteSettings(),
        getIntegrationsStatus(),
      ])
      setForm(dtoToForm(settings))
      setStatus(integrations)
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
      const payload = buildCdekPayload(form)
      const saved = await updateCdekSettings(payload)
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
      <PageHeader title="Доставка (СДЭК)" />

      <Card title="Ключи на сервере">
        <p className="muted-text">
          Client ID / Secret задаются только через переменные окружения сервера. Здесь — статус
          наличия.
        </p>
        {status?.cdekConfigured ? (
          <Badge variant="success">Ключи CDEK заданы</Badge>
        ) : (
          <Badge variant="danger">Ключи CDEK не заданы</Badge>
        )}
      </Card>

      <form className="form-stack" onSubmit={onSubmit}>
        <Card title="Режим API">
          <p className="muted-text">Пустое значение — fallback на env (CDEK_ENV).</p>
          <Field label="Окружение CDEK" htmlFor="cdek-env">
            <Select id="cdek-env" value={form.cdekEnv} onChange={setField('cdekEnv')}>
              <option value="">По умолчанию (env)</option>
              <option value="test">test</option>
              <option value="production">production</option>
            </Select>
          </Field>
        </Card>

        <Card title="Отправитель">
          <Field label="Код города отправителя" htmlFor="cdek-sender-city">
            <Input
              id="cdek-sender-city"
              inputMode="numeric"
              value={form.cdekSenderCityCode}
              onChange={setField('cdekSenderCityCode')}
              placeholder="137"
            />
          </Field>

          <Field label="Индекс" htmlFor="cdek-sender-postal">
            <Input
              id="cdek-sender-postal"
              value={form.cdekSenderPostalCode}
              onChange={setField('cdekSenderPostalCode')}
              placeholder="192102"
            />
          </Field>

          <Field label="Адрес" htmlFor="cdek-sender-address">
            <Input
              id="cdek-sender-address"
              value={form.cdekSenderAddress}
              onChange={setField('cdekSenderAddress')}
            />
          </Field>

          <Field label="Имя отправителя" htmlFor="cdek-sender-name">
            <Input
              id="cdek-sender-name"
              value={form.cdekSenderName}
              onChange={setField('cdekSenderName')}
            />
          </Field>

          <Field label="Телефон отправителя" htmlFor="cdek-sender-phone">
            <Input
              id="cdek-sender-phone"
              value={form.cdekSenderPhone}
              onChange={setField('cdekSenderPhone')}
              placeholder="+79001112233"
            />
          </Field>
        </Card>

        <Card title="Тарифы">
          <Field label="Тариф до двери" htmlFor="cdek-tariff-door">
            <Input
              id="cdek-tariff-door"
              inputMode="numeric"
              value={form.cdekTariffDoor}
              onChange={setField('cdekTariffDoor')}
              placeholder="139"
            />
          </Field>

          <Field label="Тариф до ПВЗ" htmlFor="cdek-tariff-pvz">
            <Input
              id="cdek-tariff-pvz"
              inputMode="numeric"
              value={form.cdekTariffPvz}
              onChange={setField('cdekTariffPvz')}
              placeholder="138"
            />
          </Field>
        </Card>

        <Card title="Габариты по умолчанию">
          <p className="muted-text">Пусто — PRODUCT_DEFAULT_* на сервере.</p>

          <Field label="Вес (г)" htmlFor="cdek-weight">
            <Input
              id="cdek-weight"
              inputMode="numeric"
              value={form.cdekDefaultWeightGrams}
              onChange={setField('cdekDefaultWeightGrams')}
              placeholder="3000"
            />
          </Field>

          <Field label="Длина (см)" htmlFor="cdek-length">
            <Input
              id="cdek-length"
              inputMode="numeric"
              value={form.cdekDefaultLengthCm}
              onChange={setField('cdekDefaultLengthCm')}
              placeholder="22"
            />
          </Field>

          <Field label="Ширина (см)" htmlFor="cdek-width">
            <Input
              id="cdek-width"
              inputMode="numeric"
              value={form.cdekDefaultWidthCm}
              onChange={setField('cdekDefaultWidthCm')}
              placeholder="12"
            />
          </Field>

          <Field label="Высота (см)" htmlFor="cdek-height">
            <Input
              id="cdek-height"
              inputMode="numeric"
              value={form.cdekDefaultHeightCm}
              onChange={setField('cdekDefaultHeightCm')}
              placeholder="18"
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
