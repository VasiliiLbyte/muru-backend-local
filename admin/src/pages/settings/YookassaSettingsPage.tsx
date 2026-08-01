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
  updateYookassaSettings,
} from '../../lib/settings-api'
import type {
  IntegrationsStatus,
  SiteSettingsDto,
  YookassaSettingsInput,
} from '../../types/settings'

type FormState = {
  yookassaVatCode: string
  yookassaVerifyIp: '' | 'true' | 'false'
}

const emptyForm = (): FormState => ({
  yookassaVatCode: '',
  yookassaVerifyIp: '',
})

const numToStr = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value)

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

const verifyIpToForm = (value: boolean | null | undefined): FormState['yookassaVerifyIp'] => {
  if (value === true) return 'true'
  if (value === false) return 'false'
  return ''
}

const dtoToForm = (dto: SiteSettingsDto): FormState => ({
  yookassaVatCode: numToStr(dto.yookassaVatCode),
  yookassaVerifyIp: verifyIpToForm(dto.yookassaVerifyIp),
})

/** Always send both YooKassa fields (empty → null = env fallback). */
export const buildYookassaPayload = (form: FormState): YookassaSettingsInput => ({
  yookassaVatCode: parseOptionalInt(form.yookassaVatCode),
  yookassaVerifyIp:
    form.yookassaVerifyIp === '' ? null : form.yookassaVerifyIp === 'true',
})

export const YookassaSettingsPage = () => {
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
      const payload = buildYookassaPayload(form)
      const saved = await updateYookassaSettings(payload)
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
      <PageHeader title="Оплата (ЮКасса)" />

      <Card title="Ключи и магазин">
        <p className="muted-text">
          Secret keys задаются только через env сервера. Shop ID — только для просмотра.
        </p>

        <div className="form-stack">
          {status?.yookassaConfigured ? (
            <Badge variant="success">ЮКасса (Telegram) — ключи заданы</Badge>
          ) : (
            <Badge variant="danger">ЮКасса (Telegram) — ключи не заданы</Badge>
          )}
          {status?.yookassaWebConfigured ? (
            <Badge variant="success">ЮКасса (Web) — ключи заданы</Badge>
          ) : (
            <Badge variant="danger">ЮКасса (Web) — ключи не заданы</Badge>
          )}

          <Field label="Shop ID (Telegram)" htmlFor="yk-shop-id">
            <Input
              id="yk-shop-id"
              value={status?.yookassaShopId || '—'}
              disabled
              readOnly
            />
          </Field>

          <Field label="Shop ID (Web)" htmlFor="yk-web-shop-id">
            <Input
              id="yk-web-shop-id"
              value={status?.yookassaWebShopId || '—'}
              disabled
              readOnly
            />
          </Field>
        </div>
      </Card>

      <form className="form-stack" onSubmit={onSubmit}>
        <Card title="Чек и webhook">
          <p className="muted-text">Пустые значения — fallback на env.</p>

          <Field label="Код НДС (vat_code)" htmlFor="yk-vat-code">
            <Input
              id="yk-vat-code"
              inputMode="numeric"
              value={form.yookassaVatCode}
              onChange={setField('yookassaVatCode')}
              placeholder="1"
            />
          </Field>

          <Field label="Проверка IP webhook" htmlFor="yk-verify-ip">
            <Select
              id="yk-verify-ip"
              value={form.yookassaVerifyIp}
              onChange={setField('yookassaVerifyIp')}
            >
              <option value="">По умолчанию (env)</option>
              <option value="true">Включена</option>
              <option value="false">Выключена</option>
            </Select>
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
