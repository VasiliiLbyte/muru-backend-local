import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonForm,
  useConfirm,
  useToast,
} from '../../components/ui'
import { ApiError } from '../../lib/api'
import {
  createPromoCode,
  deletePromoCode,
  listPromoCodes,
  patchPromoCode,
  type AdminPromoCode,
} from '../../lib/promo-codes-api'
import {
  buildPromoPayload,
  emptyPromoForm,
  promoFormFromCode,
  validatePromoForm,
  type PromoFormState,
} from './promo-form-utils'

export const PromoCodeEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()

  const isNew = !id || id === 'new'
  const promoId = !isNew && id ? Number.parseInt(id, 10) : null
  const validPromoId = promoId != null && Number.isInteger(promoId) && promoId > 0 ? promoId : null

  const [form, setForm] = useState<PromoFormState>(emptyPromoForm())
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadedPromo, setLoadedPromo] = useState<AdminPromoCode | null>(null)

  useEffect(() => {
    if (isNew || validPromoId == null) {
      if (!isNew && validPromoId == null) {
        setError('Некорректный идентификатор промокода')
        setLoading(false)
      }
      return
    }

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const items = await listPromoCodes()
        const promo = items.find((item) => item.id === validPromoId)
        if (!promo) {
          setError('Промокод не найден')
          return
        }
        setLoadedPromo(promo)
        setForm(promoFormFromCode(promo))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить промокод')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [isNew, validPromoId])

  const patchForm = (patch: Partial<PromoFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const validationError = validatePromoForm(form)
    if (validationError) {
      setError(validationError)
      toast.error(validationError)
      return
    }

    setSaving(true)
    setError('')

    const payload = buildPromoPayload(form)

    try {
      if (isNew) {
        const created = await createPromoCode(payload)
        toast.success('Промокод создан')
        navigate(`/promo-codes/${created.id}`, { replace: true })
      } else if (validPromoId != null) {
        await patchPromoCode(validPromoId, payload)
        toast.success('Сохранено')
      }
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 409
          ? err.message || 'Промокод с таким кодом уже существует'
          : err instanceof Error
            ? err.message
            : 'Не удалось сохранить промокод'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (validPromoId == null) return

    const ok = await confirm({
      title: 'Удалить промокод?',
      message: 'Запись будет удалена без возможности восстановления.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return

    try {
      await deletePromoCode(validPromoId)
      toast.success('Промокод удалён')
      navigate('/promo-codes')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить промокод'
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
        title={isNew ? 'Новый промокод' : `Промокод ${loadedPromo?.code ?? ''}`}
        backTo="/promo-codes"
        backLabel="К списку"
        actions={
          !isNew && validPromoId != null ? (
            <>
              <Link className="muru-btn muru-btn--secondary" to={`/promo-codes/${validPromoId}/usages`}>
                Использования
              </Link>
              <Button type="button" variant="danger" onClick={() => void onDelete()}>
                Удалить
              </Button>
            </>
          ) : undefined
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      <Card title="Параметры промокода">
        <form className="form-stack" onSubmit={onSubmit}>
          <Field label="Код" htmlFor="promo-code">
            <Input
              id="promo-code"
              value={form.code}
              onChange={(e) => patchForm({ code: e.target.value.toUpperCase() })}
              placeholder="TEST10"
              autoComplete="off"
              required
            />
          </Field>

          <Field label="Тип скидки" htmlFor="promo-discount-type">
            <Select
              id="promo-discount-type"
              value={form.discountType}
              onChange={(e) =>
                patchForm({
                  discountType: e.target.value === 'fixed' ? 'fixed' : 'percent',
                })
              }
            >
              <option value="percent">Процент (%)</option>
              <option value="fixed">Фиксированная (₽)</option>
            </Select>
          </Field>

          <Field
            label={form.discountType === 'percent' ? 'Скидка, %' : 'Скидка, ₽'}
            htmlFor="promo-discount-value"
          >
            <Input
              id="promo-discount-value"
              type="number"
              min={form.discountType === 'percent' ? 1 : 0.01}
              max={form.discountType === 'percent' ? 100 : undefined}
              step={form.discountType === 'percent' ? 1 : 0.01}
              value={form.discountValue}
              onChange={(e) => patchForm({ discountValue: e.target.value })}
              required
            />
          </Field>

          <Field label="Мин. сумма заказа, ₽" htmlFor="promo-min-order">
            <Input
              id="promo-min-order"
              type="number"
              min={0}
              step={1}
              value={form.minOrderAmount}
              onChange={(e) => patchForm({ minOrderAmount: e.target.value })}
            />
          </Field>

          <Field label="Действует с" htmlFor="promo-starts-at">
            <Input
              id="promo-starts-at"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => patchForm({ startsAt: e.target.value })}
            />
          </Field>

          <Field label="Действует до" htmlFor="promo-expires-at">
            <Input
              id="promo-expires-at"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => patchForm({ expiresAt: e.target.value })}
            />
          </Field>

          <Field label="Общий лимит использований" htmlFor="promo-usage-limit">
            <Input
              id="promo-usage-limit"
              type="number"
              min={1}
              step={1}
              value={form.usageLimit}
              onChange={(e) => patchForm({ usageLimit: e.target.value })}
              placeholder="Без лимита"
            />
          </Field>

          <Field label="Лимит на пользователя" htmlFor="promo-usage-limit-per-user">
            <Input
              id="promo-usage-limit-per-user"
              type="number"
              min={1}
              step={1}
              value={form.usageLimitPerUser}
              onChange={(e) => patchForm({ usageLimitPerUser: e.target.value })}
              required
            />
          </Field>

          <Checkbox
            id="promo-is-active"
            label="Активен"
            checked={form.isActive}
            onChange={(e) => patchForm({ isActive: e.target.checked })}
          />

          <div className="form-actions">
            <Button type="submit" loading={saving}>
              {isNew ? 'Создать' : 'Сохранить'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/promo-codes')}>
              Отмена
            </Button>
          </div>
        </form>
      </Card>
    </section>
  )
}
