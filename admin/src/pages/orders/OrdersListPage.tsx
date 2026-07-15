import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'

import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui'
import { cn } from '../../lib/cn'
import { ORDER_STATUSES } from '../../constants/order-statuses'
import { listOrders } from '../../lib/orders-api'
import type { CrmOrderListItem, CrmOrdersListResult, OrderChannel } from '../../types/orders'
import {
  formatMoney,
  formatOrderDate,
  getChannelLabel,
  getPaymentLabel,
  isOrderPaid,
} from '../../utils/order-labels'

const PAGE_SIZE = 20

const STATUS_TAB_ORDER = ORDER_STATUSES.filter((status) => status !== 'Черновик')

export const OrdersListPage = () => {
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [channel, setChannel] = useState<OrderChannel | undefined>(undefined)
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CrmOrdersListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setQ(qInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [qInput])

  useEffect(() => {
    setPage(1)
  }, [status, channel, q, dateFrom, dateTo])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listOrders({
        status,
        channel,
        q: q || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить заказы')
    } finally {
      setLoading(false)
    }
  }, [status, channel, q, dateFrom, dateTo, page])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = useMemo(() => {
    if (!data) return 1
    return Math.max(1, Math.ceil(data.total / data.pageSize))
  }, [data])

  const statusTabs = useMemo(() => {
    const counts = data?.statusCounts ?? {}
    return STATUS_TAB_ORDER.filter((s) => counts[s] != null || s === status)
  }, [data?.statusCounts, status])

  const renderCustomer = (order: CrmOrderListItem) => {
    const parts = [order.customerName, order.customerPhone].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : '—'
  }

  return (
    <section className="page-stack">
      <PageHeader title="Заказы" />

      <div className="orders-status-tabs" aria-label="Фильтр по статусу">
        <Button
          type="button"
          variant="ghost"
          className={cn(status === undefined && 'orders-status-tab--active')}
          onClick={() => setStatus(undefined)}
        >
          Все{data ? ` (${data.total})` : ''}
        </Button>
        {statusTabs.map((tabStatus) => (
          <Button
            key={tabStatus}
            type="button"
            variant="ghost"
            className={cn(status === tabStatus && 'orders-status-tab--active')}
            onClick={() => setStatus(tabStatus)}
          >
            {tabStatus}
            {data?.statusCounts[tabStatus] != null ? ` (${data.statusCounts[tabStatus]})` : ''}
          </Button>
        ))}
      </div>

      <div className="filters-panel">
        <Field label="Канал" htmlFor="orders-channel">
          <Select
            id="orders-channel"
            value={channel ?? ''}
            onChange={(e) => {
              const value = e.target.value
              setChannel(value === 'telegram' || value === 'web' ? value : undefined)
            }}
          >
            <option value="">Все</option>
            <option value="telegram">Telegram</option>
            <option value="web">Сайт</option>
          </Select>
        </Field>

        <Field label="Поиск" htmlFor="orders-search">
          <Input
            id="orders-search"
            type="search"
            placeholder="№, телефон, имя, адрес…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </Field>

        <Field label="С" htmlFor="orders-date-from">
          <Input
            id="orders-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </Field>

        <Field label="По" htmlFor="orders-date-to">
          <Input
            id="orders-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </Field>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <SkeletonTable rows={8} cols={8} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Заказов нет" />
      ) : (
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              <TableHead>№</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Канал</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead numeric>Состав</TableHead>
              <TableHead numeric>Сумма</TableHead>
              <TableHead>Оплата</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Link className="muru-page-header__back" to={`/orders/${order.id}`}>
                    #{order.id}
                  </Link>
                </TableCell>
                <TableCell>{formatOrderDate(order.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant="neutral">{getChannelLabel(order.channel)}</Badge>
                </TableCell>
                <TableCell>{renderCustomer(order)}</TableCell>
                <TableCell numeric>{order.itemsCount} шт.</TableCell>
                <TableCell numeric>{formatMoney(order.total)}</TableCell>
                <TableCell>
                  <Badge variant={isOrderPaid(order) ? 'success' : 'warning'}>
                    {getPaymentLabel(order)}
                  </Badge>
                </TableCell>
                <TableCell>{order.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="orders-pagination">
        <Button
          type="button"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Назад
        </Button>
        <span className="muted-text">
          Стр. {data?.page ?? page} из {totalPages}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={!data || page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Вперёд
        </Button>
      </div>
    </section>
  )
}
