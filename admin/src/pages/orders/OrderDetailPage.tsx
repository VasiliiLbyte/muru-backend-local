import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { CRM_EDITABLE_STATUSES, ORDER_STATUS_CANCELLED } from '../../constants/order-statuses'
import { ApiError } from '../../lib/api'
import { cancelOrder, getOrder, patchOrder } from '../../lib/orders-api'
import type { CrmOrderDetail } from '../../types/orders'
import {
  deliveryEtaToInput,
  formatMoney,
  formatOrderDate,
  getChannelLabel,
  getPaymentLabel,
  inputToDeliveryEta,
  isOrderPaid,
} from '../../utils/order-labels'

const hasCdekData = (order: CrmOrderDetail) =>
  Boolean(
    order.cdekCityName ||
      order.cdekPvzAddress ||
      order.cdekTrackNumber ||
      order.cdekStatus ||
      order.cdekSyncState !== 'none' ||
      order.cdekCreateError,
  )

export const OrderDetailPage = () => {
  const { id } = useParams()
  const orderId = Number(id)

  const [order, setOrder] = useState<CrmOrderDetail | null>(null)
  const [status, setStatus] = useState('')
  const [adminComment, setAdminComment] = useState('')
  const [deliveryEta, setDeliveryEta] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  const applyOrderToForm = (data: CrmOrderDetail) => {
    setStatus(data.status)
    setAdminComment(data.adminComment)
    setDeliveryEta(deliveryEtaToInput(data.deliveryEta))
  }

  const load = useCallback(async () => {
    if (!Number.isInteger(orderId) || orderId <= 0) {
      setError('Некорректный номер заказа')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const data = await getOrder(orderId)
      setOrder(data)
      applyOrderToForm(data)
    } catch (err) {
      setOrder(null)
      setError(err instanceof Error ? err.message : 'Не удалось загрузить заказ')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!order) return

    setSaving(true)
    setError('')
    try {
      const updated = await patchOrder(order.id, {
        status,
        adminComment,
        deliveryEta: inputToDeliveryEta(deliveryEta),
      })
      setOrder(updated)
      applyOrderToForm(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const onCancel = async () => {
    if (!order || order.status === ORDER_STATUS_CANCELLED) return
    if (
      !window.confirm(
        'Заказ будет отменён, остатки товаров вернутся на склад. Продолжить?',
      )
    ) {
      return
    }

    setCancelling(true)
    setError('')
    try {
      const updated = await cancelOrder(order.id)
      setOrder(updated)
      applyOrderToForm(updated)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Заказ уже отменён')
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось отменить заказ')
      }
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return <p className="muted-text">Загрузка...</p>
  }

  if (!order) {
    return (
      <section className="orders-module">
        <p className="error-text">{error || 'Заказ не найден'}</p>
        <Link className="link-button" to="/orders">
          ← К списку
        </Link>
      </section>
    )
  }

  return (
    <section className="orders-module">
      <div className="content-form-header">
        <h2 className="content-title">Заказ #{order.id}</h2>
        <Link className="link-button" to="/orders">
          ← К списку
        </Link>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="form-section">
        <div className="order-detail-header">
          <span className={`badge badge-channel-${order.channel}`}>
            {getChannelLabel(order.channel)}
          </span>
          <span className="order-detail-status">{order.status}</span>
          <span className="muted-text">Создан: {formatOrderDate(order.createdAt)}</span>
          <span className="muted-text">Обновлён: {formatOrderDate(order.updatedAt)}</span>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Состав</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th />
                <th>Товар</th>
                <th>SKU</th>
                <th>Кол-во</th>
                <th>Цена</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={`${item.sku}-${item.color ?? ''}-${item.size ?? ''}`}>
                  <td>
                    {item.imageUrl ? (
                      <img className="order-thumb" src={item.imageUrl} alt={item.name} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {item.name}
                    {item.color || item.size ? (
                      <div className="muted-text">
                        {[item.color, item.size].filter(Boolean).join(' / ')}
                      </div>
                    ) : null}
                  </td>
                  <td>{item.sku}</td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(item.price)}</td>
                  <td>{formatMoney(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Суммы</h3>
        <p>Подытог: {formatMoney(order.subtotal)}</p>
        <p>
          Доставка: {formatMoney(order.deliveryPrice)}
          {order.deliveryOption ? ` (${order.deliveryOption})` : ''}
        </p>
        {order.promoCode || order.promoDiscount > 0 ? (
          <p>
            Промо: {order.promoCode ?? '—'} (−{formatMoney(order.promoDiscount)})
          </p>
        ) : null}
        <p>
          <strong>Итого: {formatMoney(order.total)}</strong>
        </p>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Контакты</h3>
        <p>{order.customerName ?? '—'}</p>
        <p>{order.customerPhone ?? '—'}</p>
        {order.channel === 'telegram' && order.telegramUserId != null ? (
          <p className="muted-text">Telegram ID: {order.telegramUserId}</p>
        ) : null}
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Адрес и доставка</h3>
        <p>Способ: {order.deliveryMode === 'pickup' ? 'Самовывоз' : 'Доставка'}</p>
        <p>Адрес: {order.address || '—'}</p>
        <p>Ориентировочная дата: {order.deliveryEta ? formatOrderDate(order.deliveryEta) : '—'}</p>
      </div>

      {hasCdekData(order) ? (
        <div className="form-section">
          <h3 className="form-section-title">CDEK</h3>
          {order.cdekCityName ? <p>Город: {order.cdekCityName}</p> : null}
          {order.cdekPvzAddress ? <p>ПВЗ: {order.cdekPvzAddress}</p> : null}
          {order.cdekTrackNumber ? <p>Трек: {order.cdekTrackNumber}</p> : null}
          {order.cdekStatus ? <p>Статус CDEK: {order.cdekStatus}</p> : null}
          <p>Синхронизация: {order.cdekSyncState}</p>
          {order.cdekCreateError ? (
            <p className="error-text">Ошибка создания: {order.cdekCreateError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="form-section">
        <h3 className="form-section-title">Оплата</h3>
        <p>
          Статус:{' '}
          <span className={`badge ${isOrderPaid(order) ? 'badge-paid' : 'badge-unpaid'}`}>
            {getPaymentLabel(order)}
          </span>
        </p>
        <p>Payment ID: {order.paymentId ?? '—'}</p>
        <p>paymentStatus: {order.paymentStatus ?? '—'}</p>
        <p>Оплачен: {order.paidAt ? formatOrderDate(order.paidAt) : '—'}</p>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Комментарий клиента</h3>
        <p>{order.comment || '—'}</p>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Согласие</h3>
        <p className="muted-text">
          {order.consentAccepted ? 'Принято' : 'Не принято'}
          {order.consentVersion ? ` · v${order.consentVersion}` : ''}
          {order.consentAcceptedAt ? ` · ${formatOrderDate(order.consentAcceptedAt)}` : ''}
        </p>
      </div>

      <form className="form-section" onSubmit={onSave}>
        <h3 className="form-section-title">Действия менеджера</h3>

        <label className="field-label" htmlFor="order-status">
          Статус
        </label>
        <select
          id="order-status"
          className="field-input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {CRM_EDITABLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="field-label" htmlFor="order-admin-comment">
          Комментарий менеджера
        </label>
        <textarea
          id="order-admin-comment"
          className="field-input field-textarea"
          value={adminComment}
          onChange={(e) => setAdminComment(e.target.value)}
        />

        <label className="field-label" htmlFor="order-delivery-eta">
          Ориентировочная дата доставки
        </label>
        <input
          id="order-delivery-eta"
          className="field-input"
          type="date"
          value={deliveryEta}
          onChange={(e) => setDeliveryEta(e.target.value)}
        />

        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={cancelling || order.status === ORDER_STATUS_CANCELLED}
            onClick={() => void onCancel()}
          >
            {cancelling ? 'Отмена…' : 'Отменить заказ'}
          </button>
        </div>
      </form>
    </section>
  )
}
