import { useCallback, useEffect, useState } from 'react'

import {
  createAdminPromoCode,
  deleteAdminPromoCode,
  fetchAdminPromoCodeUsages,
  fetchAdminPromoCodes,
  patchAdminPromoCode,
  type AdminPromoCode,
  type AdminPromoCodeUsage,
  type CreateAdminPromoCodePayload,
  type PromoDiscountType,
} from '../lib/api'
import { pressable, pressableDisabled } from '../lib/uiClasses'

type AdminPromoCodesSectionProps = {
  userId: number
}

type PromoFormState = {
  code: string
  discountType: PromoDiscountType
  discountValue: string
  minOrderAmount: string
  startsAt: string
  expiresAt: string
  usageLimit: string
  usageLimitPerUser: string
  isActive: boolean
}

const emptyForm = (): PromoFormState => ({
  code: '',
  discountType: 'percent',
  discountValue: '10',
  minOrderAmount: '0',
  startsAt: '',
  expiresAt: '',
  usageLimit: '',
  usageLimitPerUser: '1',
  isActive: true,
})

const formFromPromo = (promo: AdminPromoCode): PromoFormState => ({
  code: promo.code,
  discountType: promo.discountType,
  discountValue: String(promo.discountValue),
  minOrderAmount: String(promo.minOrderAmount),
  startsAt: promo.startsAt ? promo.startsAt.slice(0, 16) : '',
  expiresAt: promo.expiresAt ? promo.expiresAt.slice(0, 16) : '',
  usageLimit: promo.usageLimit != null ? String(promo.usageLimit) : '',
  usageLimitPerUser: String(promo.usageLimitPerUser),
  isActive: promo.isActive,
})

const statusBadgeClass = (status: AdminPromoCode['status']) => {
  if (status === 'Активен') return 'bg-green-100 text-green-800'
  if (status === 'Отключён') return 'bg-gray-200 text-gray-700'
  return 'bg-amber-100 text-amber-900'
}

const toIsoOrNull = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const buildPayload = (form: PromoFormState): CreateAdminPromoCodePayload => {
  const usageLimitRaw = form.usageLimit.trim()
  return {
    code: form.code.trim(),
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    minOrderAmount: Number(form.minOrderAmount) || 0,
    startsAt: toIsoOrNull(form.startsAt),
    expiresAt: toIsoOrNull(form.expiresAt),
    usageLimit: usageLimitRaw ? Number(usageLimitRaw) : null,
    usageLimitPerUser: Number(form.usageLimitPerUser) || 1,
    isActive: form.isActive,
  }
}

export const AdminPromoCodesSection = ({ userId }: AdminPromoCodesSectionProps) => {
  const [items, setItems] = useState<AdminPromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminPromoCode | null>(null)
  const [form, setForm] = useState<PromoFormState>(emptyForm())
  const [usagesPromo, setUsagesPromo] = useState<AdminPromoCode | null>(null)
  const [usages, setUsages] = useState<AdminPromoCodeUsage[]>([])
  const [usagesLoading, setUsagesLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminPromoCodes(userId)
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить промокоды')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (promo: AdminPromoCode) => {
    setEditing(promo)
    setForm(formFromPromo(promo))
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm())
  }

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      const payload = buildPayload(form)
      if (editing) {
        await patchAdminPromoCode(userId, editing.id, payload)
      } else {
        await createAdminPromoCode(userId, payload)
      }
      closeModal()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (promo: AdminPromoCode) => {
    if (!window.confirm(`Удалить промокод ${promo.code}?`)) return
    setBusy(true)
    setError(null)
    try {
      await deleteAdminPromoCode(userId, promo.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    } finally {
      setBusy(false)
    }
  }

  const openUsages = async (promo: AdminPromoCode) => {
    setUsagesPromo(promo)
    setUsagesLoading(true)
    setUsages([])
    try {
      const data = await fetchAdminPromoCodeUsages(userId, promo.id)
      setUsages(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить историю')
      setUsagesPromo(null)
    } finally {
      setUsagesLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-muru-olive">Промокоды</h2>
        <button type="button" className={pressable} onClick={openCreate}>
          + Создать
        </button>
      </div>

      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <p className="text-sm text-muru-olive/80">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muru-olive/80">Промокодов пока нет.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-muru-accent">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#efe8d8] text-xs uppercase text-[#5c5346]">
              <tr>
                <th className="px-3 py-2">Код</th>
                <th className="px-3 py-2">Скидка</th>
                <th className="px-3 py-2">Использовано</th>
                <th className="px-3 py-2">До</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((promo) => (
                <tr key={promo.id} className="border-t border-[#d8cfbc]">
                  <td className="px-3 py-2 font-medium">{promo.code}</td>
                  <td className="px-3 py-2">
                    {promo.discountType === 'percent'
                      ? `${promo.discountValue}%`
                      : `${promo.discountValue} ₽`}
                  </td>
                  <td className="px-3 py-2">
                    {promo.usedCount}
                    {promo.usageLimit != null ? ` / ${promo.usageLimit}` : ' / ∞'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(promo.status)}`}
                    >
                      {promo.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className={`${pressable} text-xs`} onClick={() => openEdit(promo)}>
                        Изменить
                      </button>
                      <button type="button" className={`${pressable} text-xs`} onClick={() => void openUsages(promo)}>
                        История
                      </button>
                      <button
                        type="button"
                        className={`${pressable} text-xs text-red-700`}
                        disabled={busy}
                        onClick={() => void handleDelete(promo)}
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
            <h3 className="text-base font-semibold text-muru-olive">
              {editing ? `Редактировать ${editing.code}` : 'Новый промокод'}
            </h3>
            <div className="mt-3 grid gap-3 text-sm">
              <label className="block space-y-1">
                <span>Код</span>
                <input
                  className="w-full rounded-lg border border-muru-olive/20 bg-white px-3 py-2 uppercase"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  disabled={busy}
                />
              </label>
              <label className="block space-y-1">
                <span>Тип скидки</span>
                <select
                  className="w-full rounded-lg border border-muru-olive/20 bg-white px-3 py-2"
                  value={form.discountType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, discountType: e.target.value as PromoDiscountType }))
                  }
                  disabled={busy}
                >
                  <option value="percent">Процент</option>
                  <option value="fixed">Фиксированная (₽)</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span>Значение</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="w-full rounded-lg border border-muru-olive/20 bg-white px-3 py-2"
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                  disabled={busy}
                />
              </label>
              <label className="block space-y-1">
                <span>Мин. сумма заказа (₽)</span>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-lg border border-muru-olive/20 bg-white px-3 py-2"
                  value={form.minOrderAmount}
                  onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                  disabled={busy}
                />
              </label>
              <label className="block space-y-1">
                <span>Начало действия</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-muru-olive/20 bg-white px-3 py-2"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  disabled={busy}
                />
              </label>
              <label className="block space-y-1">
                <span>Окончание</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-muru-olive/20 bg-white px-3 py-2"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  disabled={busy}
                />
              </label>
              <label className="block space-y-1">
                <span>Общий лимит (пусто = без лимита)</span>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-lg border border-muru-olive/20 bg-white px-3 py-2"
                  value={form.usageLimit}
                  onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                  disabled={busy}
                />
              </label>
              <label className="block space-y-1">
                <span>Лимит на пользователя</span>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-lg border border-muru-olive/20 bg-white px-3 py-2"
                  value={form.usageLimitPerUser}
                  onChange={(e) => setForm((f) => ({ ...f, usageLimitPerUser: e.target.value }))}
                  disabled={busy}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  disabled={busy}
                />
                <span>Активен</span>
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className={busy ? pressableDisabled : pressable}
                disabled={busy}
                onClick={() => void handleSave()}
              >
                Сохранить
              </button>
              <button type="button" className={pressable} onClick={closeModal} disabled={busy}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {usagesPromo ? (
        <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-muru-olive">История: {usagesPromo.code}</h3>
              <button type="button" className={pressable} onClick={() => setUsagesPromo(null)}>
                Закрыть
              </button>
            </div>
            {usagesLoading ? (
              <p className="mt-3 text-sm">Загрузка…</p>
            ) : usages.length === 0 ? (
              <p className="mt-3 text-sm text-muru-olive/80">Использований пока нет.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {usages.map((u) => (
                  <li key={u.id} className="rounded-lg bg-[#efe8d8] px-3 py-2">
                    <p>User {u.telegramUserId}</p>
                    <p className="text-xs text-[#5c5346]">
                      {u.orderId ? `Заказ #${u.orderId}` : 'Без заказа'} ·{' '}
                      {new Date(u.usedAt).toLocaleString('ru-RU')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
