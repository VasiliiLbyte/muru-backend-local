import { useCallback, useEffect, useState } from 'react'

import { fetchAdminOrders, type AdminOrderListItem } from '../lib/api'
import { pressable, pressableDisabled } from '../lib/uiClasses'

import { AdminOrderDetailDrawer } from './AdminOrderDetailDrawer'
import {
  ORDER_STATUS_OPTIONS,
  formatMoney,
  formatOrderDate,
  orderStatusBadgeClass,
} from './order-status-ui'

type AdminOrdersSectionProps = {
  userId: number
}

export const AdminOrdersSection = ({ userId }: AdminOrdersSectionProps) => {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AdminOrderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, status, dateFrom, dateTo])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminOrders(userId, {
        q: debouncedQ || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
      })
      setItems(data.items)
      setTotal(data.total)
      setPageSize(data.pageSize)
      setStatusCounts(data.statusCounts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить заказы')
    } finally {
      setLoading(false)
    }
  }, [userId, debouncedQ, status, dateFrom, dateTo, page])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const statusLabel = (value: string): string => {
    const count = statusCounts[value]
    if (count != null && count > 0) {
      return `${value} (${count})`
    }
    return value
  }

  const openOrder = (id: number) => setSelectedOrderId(id)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-muru-olive">Заказы</h1>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-medium text-[#5c5346]">Поиск</span>
          <input
            type="search"
            className="mt-1 w-full rounded-lg border border-[#d8cfbc] bg-white px-3 py-2 text-sm"
            placeholder="№, адрес, телефон, имя"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="sm:w-48">
          <span className="text-xs font-medium text-[#5c5346]">Статус</span>
          <select
            className="mt-1 w-full rounded-lg border border-[#d8cfbc] bg-white px-2 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Все</option>
            {ORDER_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-medium text-[#5c5346]">С</span>
          <input
            type="date"
            className="mt-1 block rounded-lg border border-[#d8cfbc] bg-white px-2 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label>
          <span className="text-xs font-medium text-[#5c5346]">По</span>
          <input
            type="date"
            className="mt-1 block rounded-lg border border-[#d8cfbc] bg-white px-2 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-[#efe8d8]" />
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#d8cfbc] text-left text-xs text-[#5c5346]">
                  <th className="py-2 pr-2">№</th>
                  <th className="py-2 pr-2">Дата</th>
                  <th className="py-2 pr-2">Клиент</th>
                  <th className="py-2 pr-2">Статус</th>
                  <th className="py-2 pr-2 text-right">Сумма</th>
                  <th className="py-2">Поз.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className={`${pressable} cursor-pointer border-b border-[#efe8d8]`}
                    onClick={() => openOrder(row.id)}
                  >
                    <td className="py-2 pr-2 font-medium">#{row.id}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{formatOrderDate(row.createdAt)}</td>
                    <td className="py-2 pr-2">
                      <div>{row.customerName || '—'}</div>
                      <div className="text-xs text-[#7a7165]">{row.customerPhone || ''}</div>
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${orderStatusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right">{formatMoney(row.total)}</td>
                    <td className="py-2">{row.itemsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-2 sm:hidden">
            {items.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`${pressable} w-full rounded-xl border border-[#d8cfbc] bg-[#efe8d8] p-3 text-left text-sm`}
                  onClick={() => openOrder(row.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">#{row.id}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${orderStatusBadgeClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#7a7165]">{formatOrderDate(row.createdAt)}</p>
                  <p className="mt-1">{row.customerName || '—'}</p>
                  <p className="font-medium">{formatMoney(row.total)}</p>
                </button>
              </li>
            ))}
          </ul>

          {items.length === 0 ? (
            <p className="text-center text-sm text-[#7a7165]">Заказов не найдено</p>
          ) : null}
        </>
      )}

      <div className="flex items-center justify-center gap-3 text-sm">
        <button
          type="button"
          className={`${pressableDisabled} rounded-lg px-3 py-1`}
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ←
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className={`${pressableDisabled} rounded-lg px-3 py-1`}
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          →
        </button>
      </div>

      <AdminOrderDetailDrawer
        userId={userId}
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onUpdated={() => void load()}
      />
    </div>
  )
}
