import { useCallback, useEffect, useState } from 'react'

import { SmartImage } from '../components/SmartImage'
import {
  fetchAdminOrderById,
  restockAdminOrder,
  updateAdminOrder,
  type AdminOrderDetail,
} from '../lib/api'
import { pressable, pressableDisabled } from '../lib/uiClasses'

import {
  ORDER_STATUS_OPTIONS,
  buildClientTelegramUrl,
  formatMoney,
  orderStatusBadgeClass,
} from './order-status-ui'

type AdminOrderDetailDrawerProps = {
  userId: number
  orderId: number | null
  onClose: () => void
  onUpdated: () => void
}

export const AdminOrderDetailDrawer = ({
  userId,
  orderId,
  onClose,
  onUpdated,
}: AdminOrderDetailDrawerProps) => {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusDraft, setStatusDraft] = useState('')
  const [adminCommentDraft, setAdminCommentDraft] = useState('')
  const [deliveryEtaDraft, setDeliveryEtaDraft] = useState('')

  const load = useCallback(async () => {
    if (orderId == null) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminOrderById(userId, orderId)
      setOrder(data)
      setStatusDraft(data.status)
      setAdminCommentDraft(data.adminComment)
      setDeliveryEtaDraft(data.deliveryEta ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить заказ')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [orderId, userId])

  useEffect(() => {
    if (orderId != null) {
      void load()
    } else {
      setOrder(null)
      setError(null)
    }
  }, [orderId, load])

  const save = async (patch: {
    status?: string
    adminComment?: string
    deliveryEta?: string | null
  }) => {
    if (orderId == null) return
    setBusy(true)
    setError(null)
    try {
      const updated = await updateAdminOrder(userId, orderId, patch)
      setOrder(updated)
      setStatusDraft(updated.status)
      setAdminCommentDraft(updated.adminComment)
      setDeliveryEtaDraft(updated.deliveryEta ?? '')
      onUpdated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const handleRestock = async () => {
    if (orderId == null) return
    if (!window.confirm('Отменить заказ и вернуть остатки на склад?')) return
    setBusy(true)
    setError(null)
    try {
      const updated = await restockAdminOrder(userId, orderId)
      setOrder(updated)
      setStatusDraft(updated.status)
      onUpdated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отмены заказа')
    } finally {
      setBusy(false)
    }
  }

  if (orderId == null) return null

  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/40" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[90vh] flex-col rounded-t-2xl border border-muru-accent bg-[#fff9ed] shadow-lg"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[#d8cfbc] px-4 py-3">
          <h2 className="text-lg font-semibold text-muru-olive">
            {order ? `Заказ #${order.id}` : 'Заказ'}
          </h2>
          <button type="button" className={`${pressable} rounded-lg px-3 py-1 text-sm`} onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-[#efe8d8]" />
          ) : null}

          {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}

          {order && !loading ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${orderStatusBadgeClass(order.status)}`}
                >
                  {order.status}
                </span>
                <span className="text-base font-semibold">{formatMoney(order.total)}</span>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-[#5c5346]">Статус</span>
                <select
                  className="mt-1 w-full rounded-lg border border-[#d8cfbc] bg-white px-2 py-2"
                  value={statusDraft}
                  disabled={busy}
                  onChange={(e) => setStatusDraft(e.target.value)}
                >
                  {ORDER_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl bg-[#efe8d8] p-3">
                <p className="font-medium text-muru-olive">Клиент</p>
                <p className="mt-1">{order.customerName || '—'}</p>
                <p>{order.customerPhone || '—'}</p>
                <p className="text-xs text-[#7a7165]">Telegram ID: {order.telegramUserId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {order.customerPhone ? (
                    <a
                      className={`${pressable} rounded-lg bg-white px-2 py-1 text-xs`}
                      href={`tel:${order.customerPhone}`}
                    >
                      Позвонить
                    </a>
                  ) : null}
                  <a
                    className={`${pressable} rounded-lg bg-white px-2 py-1 text-xs`}
                    href={buildClientTelegramUrl(order.telegramUserId, order.customerPhone)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Написать в Telegram
                  </a>
                </div>
              </div>

              {order.promoDiscount > 0 && order.promoCode ? (
                <div className="rounded-xl bg-[#efe8d8] p-3">
                  <p className="font-medium text-muru-olive">Промокод</p>
                  <p className="mt-1">
                    {order.promoCode} · скидка {formatMoney(order.promoDiscount)}
                  </p>
                </div>
              ) : null}

              <div className="rounded-xl bg-[#efe8d8] p-3">
                <p className="font-medium text-muru-olive">Доставка</p>
                <p className="mt-1">
                  {order.deliveryMode === 'pickup' ? 'Самовывоз' : 'Доставка'}
                  {order.deliveryOption ? ` · ${order.deliveryOption}` : ''}
                </p>
                <label className="mt-2 block">
                  <span className="text-xs text-[#5c5346]">ETA</span>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-[#d8cfbc] bg-white px-2 py-1"
                    value={deliveryEtaDraft}
                    disabled={busy}
                    onChange={(e) => setDeliveryEtaDraft(e.target.value)}
                    onBlur={() =>
                      void save({
                        deliveryEta: deliveryEtaDraft.trim() || null,
                      })
                    }
                  />
                </label>
                <p className="mt-2 text-xs text-[#5c5346]">Адрес: {order.address || '—'}</p>
                {order.comment ? (
                  <p className="mt-1 text-xs">Комментарий клиента: {order.comment}</p>
                ) : null}
              </div>

              <div>
                <p className="mb-2 font-medium text-muru-olive">Товары</p>
                <ul className="grid gap-2">
                  {order.items.map((item) => (
                    <li
                      key={`${item.sku}-${item.color}-${item.size}`}
                      className="flex gap-3 rounded-lg bg-[#efe8d8] p-2"
                    >
                      <SmartImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-16 w-16 shrink-0 rounded-md object-cover bg-white"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-[#7a7165]">{item.sku}</p>
                        <p className="mt-1">
                          {item.quantity} × {formatMoney(item.price)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-[#5c5346]">Комментарий админа</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-[#d8cfbc] bg-white px-2 py-2 text-sm"
                  rows={3}
                  value={adminCommentDraft}
                  disabled={busy}
                  onChange={(e) => setAdminCommentDraft(e.target.value)}
                  onBlur={() => void save({ adminComment: adminCommentDraft })}
                />
              </label>

              <div className="flex flex-wrap gap-2 pb-2">
                <button
                  type="button"
                  className={`${pressableDisabled} rounded-xl bg-muru-olive px-4 py-2 text-sm font-medium text-muru-ivory`}
                  disabled={busy}
                  onClick={() =>
                    void save({
                      status: statusDraft,
                      adminComment: adminCommentDraft,
                      deliveryEta: deliveryEtaDraft.trim() || null,
                    })
                  }
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  className={`${pressableDisabled} rounded-xl bg-[#e3dccd] px-4 py-2 text-sm font-medium`}
                  disabled={busy || order.status === 'Отменён'}
                  onClick={() => void handleRestock()}
                >
                  Отменить заказ + вернуть остатки
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
