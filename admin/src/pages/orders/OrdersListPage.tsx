import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

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
    <section className="orders-module">
      <header className="content-header">
        <h2 className="content-title">Заказы</h2>
      </header>

      <div className="orders-filters">
        <nav className="orders-status-tabs" aria-label="Фильтр по статусу">
          <button
            type="button"
            className={`content-tab${status === undefined ? ' content-tab-active' : ''}`}
            onClick={() => setStatus(undefined)}
          >
            Все{data ? ` (${data.total})` : ''}
          </button>
          {statusTabs.map((tabStatus) => (
            <button
              key={tabStatus}
              type="button"
              className={`content-tab${status === tabStatus ? ' content-tab-active' : ''}`}
              onClick={() => setStatus(tabStatus)}
            >
              {tabStatus}
              {data?.statusCounts[tabStatus] != null ? ` (${data.statusCounts[tabStatus]})` : ''}
            </button>
          ))}
        </nav>

        <div className="orders-filter-row">
          <label className="field-label" htmlFor="orders-channel">
            Канал
          </label>
          <select
            id="orders-channel"
            className="field-input orders-filter-input"
            value={channel ?? ''}
            onChange={(e) => {
              const value = e.target.value
              setChannel(value === 'telegram' || value === 'web' ? value : undefined)
            }}
          >
            <option value="">Все</option>
            <option value="telegram">Telegram</option>
            <option value="web">Сайт</option>
          </select>

          <label className="field-label" htmlFor="orders-search">
            Поиск
          </label>
          <input
            id="orders-search"
            className="field-input orders-filter-input orders-search-input"
            type="search"
            placeholder="№, телефон, имя, адрес…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />

          <label className="field-label" htmlFor="orders-date-from">
            С
          </label>
          <input
            id="orders-date-from"
            className="field-input orders-filter-input"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />

          <label className="field-label" htmlFor="orders-date-to">
            По
          </label>
          <input
            id="orders-date-to"
            className="field-input orders-filter-input"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <p className="muted-text">Загрузка...</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Дата</th>
                  <th>Канал</th>
                  <th>Клиент</th>
                  <th>Состав</th>
                  <th>Сумма</th>
                  <th>Оплата</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {!data || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted-text">
                      Заказов нет
                    </td>
                  </tr>
                ) : (
                  data.items.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link className="link-button" to={`/orders/${order.id}`}>
                          #{order.id}
                        </Link>
                      </td>
                      <td>{formatOrderDate(order.createdAt)}</td>
                      <td>
                        <span
                          className={`badge badge-channel-${order.channel}`}
                        >
                          {getChannelLabel(order.channel)}
                        </span>
                      </td>
                      <td>{renderCustomer(order)}</td>
                      <td>{order.itemsCount} шт.</td>
                      <td>{formatMoney(order.total)}</td>
                      <td>
                        <span
                          className={`badge ${isOrderPaid(order) ? 'badge-paid' : 'badge-unpaid'}`}
                        >
                          {getPaymentLabel(order)}
                        </span>
                      </td>
                      <td>{order.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="orders-pagination">
            <button
              type="button"
              className="secondary-button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Назад
            </button>
            <span className="muted-text">
              Стр. {data?.page ?? page} из {totalPages}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={!data || page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд
            </button>
          </div>
        </>
      )}
    </section>
  )
}
