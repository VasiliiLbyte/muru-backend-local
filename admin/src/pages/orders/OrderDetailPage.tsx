import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonForm,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  useConfirm,
  useToast,
} from '../../components/ui'
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
  const confirm = useConfirm()
  const toast = useToast()

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
      toast.success('Сохранено')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const onCancel = async () => {
    if (!order || order.status === ORDER_STATUS_CANCELLED) return
    const ok = await confirm({
      title: 'Отменить заказ?',
      message: 'Заказ будет отменён, остатки товаров вернутся на склад.',
      confirmLabel: 'Отменить заказ',
      variant: 'danger',
    })
    if (!ok) return

    setCancelling(true)
    setError('')
    try {
      const updated = await cancelOrder(order.id)
      setOrder(updated)
      applyOrderToForm(updated)
      toast.success('Заказ отменён')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const message = 'Заказ уже отменён'
        setError(message)
        toast.error(message)
      } else {
        const message = err instanceof Error ? err.message : 'Не удалось отменить заказ'
        setError(message)
        toast.error(message)
      }
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <section className="page-stack">
        <SkeletonForm />
      </section>
    )
  }

  if (!order) {
    return (
      <section className="page-stack">
        <p className="error-text">{error || 'Заказ не найден'}</p>
        <Link className="muru-page-header__back" to="/orders">
          К списку
        </Link>
      </section>
    )
  }

  return (
    <section className="page-stack">
      <PageHeader title={`Заказ #${order.id}`} backTo="/orders" backLabel="К списку" />

      {error ? <p className="error-text">{error}</p> : null}

      <Card title="Обзор">
        <div className="order-detail-meta">
          <Badge variant="neutral">{getChannelLabel(order.channel)}</Badge>
          <span>{order.status}</span>
          <span className="muted-text">Создан: {formatOrderDate(order.createdAt)}</span>
          <span className="muted-text">Обновлён: {formatOrderDate(order.updatedAt)}</span>
        </div>
      </Card>

      <Card title="Состав">
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              <TableHead />
              <TableHead>Товар</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead numeric>Кол-во</TableHead>
              <TableHead numeric>Цена</TableHead>
              <TableHead numeric>Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={`${item.sku}-${item.color ?? ''}-${item.size ?? ''}`}>
                <TableCell>
                  {item.imageUrl ? (
                    <img className="order-thumb" src={item.imageUrl} alt={item.name} />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  {item.name}
                  {item.color || item.size ? (
                    <div className="muted-text">
                      {[item.color, item.size].filter(Boolean).join(' / ')}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{item.sku}</TableCell>
                <TableCell numeric>{item.quantity}</TableCell>
                <TableCell numeric>{formatMoney(item.price)}</TableCell>
                <TableCell numeric>{formatMoney(item.price * item.quantity)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card title="Суммы">
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
      </Card>

      <Card title="Контакты">
        <p>{order.customerName ?? '—'}</p>
        <p>{order.customerPhone ?? '—'}</p>
        {order.channel === 'telegram' && order.telegramUserId != null ? (
          <p className="muted-text">Telegram ID: {order.telegramUserId}</p>
        ) : null}
      </Card>

      <Card title="Адрес и доставка">
        <p>Способ: {order.deliveryMode === 'pickup' ? 'Самовывоз' : 'Доставка'}</p>
        <p>Адрес: {order.address || '—'}</p>
        <p>Ориентировочная дата: {order.deliveryEta ? formatOrderDate(order.deliveryEta) : '—'}</p>
      </Card>

      {hasCdekData(order) ? (
        <Card title="CDEK">
          {order.cdekCityName ? <p>Город: {order.cdekCityName}</p> : null}
          {order.cdekPvzAddress ? <p>ПВЗ: {order.cdekPvzAddress}</p> : null}
          {order.cdekTrackNumber ? <p>Трек: {order.cdekTrackNumber}</p> : null}
          {order.cdekStatus ? <p>Статус CDEK: {order.cdekStatus}</p> : null}
          <p>Синхронизация: {order.cdekSyncState}</p>
          {order.cdekCreateError ? (
            <p className="error-text">Ошибка создания: {order.cdekCreateError}</p>
          ) : null}
        </Card>
      ) : null}

      <Card title="Оплата">
        <p>
          Статус:{' '}
          <Badge variant={isOrderPaid(order) ? 'success' : 'warning'}>
            {getPaymentLabel(order)}
          </Badge>
        </p>
        <p>Payment ID: {order.paymentId ?? '—'}</p>
        <p>paymentStatus: {order.paymentStatus ?? '—'}</p>
        <p>Оплачен: {order.paidAt ? formatOrderDate(order.paidAt) : '—'}</p>
      </Card>

      <Card title="Комментарий клиента">
        <p>{order.comment || '—'}</p>
      </Card>

      <Card title="Согласие">
        <p className="muted-text">
          {order.consentAccepted ? 'Принято' : 'Не принято'}
          {order.consentVersion ? ` · v${order.consentVersion}` : ''}
          {order.consentAcceptedAt ? ` · ${formatOrderDate(order.consentAcceptedAt)}` : ''}
        </p>
      </Card>

      <Card title="Действия менеджера">
        <form className="form-stack" onSubmit={onSave}>
          <Field label="Статус" htmlFor="order-status">
            <Select id="order-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {CRM_EDITABLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Комментарий менеджера" htmlFor="order-admin-comment">
            <Textarea
              id="order-admin-comment"
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
            />
          </Field>

          <Field label="Ориентировочная дата доставки" htmlFor="order-delivery-eta">
            <Input
              id="order-delivery-eta"
              type="date"
              value={deliveryEta}
              onChange={(e) => setDeliveryEta(e.target.value)}
            />
          </Field>

          <div className="form-actions">
            <Button type="submit" loading={saving}>
              Сохранить
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={cancelling}
              disabled={order.status === ORDER_STATUS_CANCELLED}
              onClick={() => void onCancel()}
            >
              Отменить заказ
            </Button>
          </div>
        </form>
      </Card>
    </section>
  )
}
