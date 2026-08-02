import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Warehouse } from 'lucide-react'

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
import { listStockMovements } from '../../lib/stock-api'
import type {
  CrmStockMovementRow,
  CrmStockMovementsListResult,
  StockMovementType,
} from '../../types/stock'
import { formatOrderDate } from '../../utils/order-labels'

const PAGE_SIZE = 20

const TYPE_LABELS: Record<StockMovementType, string> = {
  sale: 'Продажа',
  return: 'Возврат',
  adjustment: 'Корректировка',
}

const typeBadgeVariant = (
  type: StockMovementType,
): 'neutral' | 'success' | 'warning' | 'danger' => {
  if (type === 'sale') return 'warning'
  if (type === 'return') return 'success'
  return 'neutral'
}

const formatDelta = (delta: number) => (delta > 0 ? `+${delta}` : String(delta))

const deltaStyle = (delta: number): CSSProperties | undefined => {
  if (delta < 0) return { color: 'var(--muru-danger)' }
  if (delta > 0) return { color: 'var(--muru-success)' }
  return undefined
}

const renderActor = (row: CrmStockMovementRow) => {
  if (row.actorLabel) return row.actorLabel
  if (row.actorType === 'admin') {
    return row.actorAdminId != null ? `admin:${row.actorAdminId}` : 'admin'
  }
  return 'system'
}

export const StockMovementsPage = () => {
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [type, setType] = useState<StockMovementType | undefined>(undefined)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CrmStockMovementsListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setQ(qInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [qInput])

  useEffect(() => {
    setPage(1)
  }, [q, type, dateFrom, dateTo])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listStockMovements({
        q: q || undefined,
        type,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить движения')
    } finally {
      setLoading(false)
    }
  }, [q, type, dateFrom, dateTo, page])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = useMemo(() => {
    if (!data) return 1
    return Math.max(1, Math.ceil(data.total / data.pageSize))
  }, [data])

  return (
    <section className="page-stack">
      <PageHeader title="Движения склада" />

      <div className="filters-panel">
        <Field label="Поиск" htmlFor="stock-search">
          <Input
            id="stock-search"
            type="search"
            placeholder="SKU или название…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </Field>

        <Field label="Тип" htmlFor="stock-type">
          <Select
            id="stock-type"
            value={type ?? ''}
            onChange={(e) => {
              const value = e.target.value
              setType(
                value === 'sale' || value === 'return' || value === 'adjustment'
                  ? value
                  : undefined,
              )
            }}
          >
            <option value="">Все</option>
            <option value="sale">Продажа</option>
            <option value="return">Возврат</option>
            <option value="adjustment">Корректировка</option>
          </Select>
        </Field>

        <Field label="С" htmlFor="stock-date-from">
          <Input
            id="stock-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </Field>

        <Field label="По" htmlFor="stock-date-to">
          <Input
            id="stock-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </Field>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <SkeletonTable rows={8} cols={8} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState icon={Warehouse} title="Движений нет" />
      ) : (
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              <TableHead>Дата</TableHead>
              <TableHead>Товар</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead numeric>Δ</TableHead>
              <TableHead numeric>Остаток</TableHead>
              <TableHead>Причина</TableHead>
              <TableHead>Заказ</TableHead>
              <TableHead>Актор</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatOrderDate(row.createdAt)}</TableCell>
                <TableCell>
                  <div>{row.productSku}</div>
                  <div className="muted-text">{row.productName || '—'}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={typeBadgeVariant(row.type)}>{TYPE_LABELS[row.type]}</Badge>
                </TableCell>
                <TableCell numeric style={deltaStyle(row.delta)}>
                  {formatDelta(row.delta)}
                </TableCell>
                <TableCell numeric>{row.stockAfter}</TableCell>
                <TableCell>{row.reason || '—'}</TableCell>
                <TableCell>
                  {row.orderId != null ? (
                    <Link to={`/orders/${row.orderId}`}>#{row.orderId}</Link>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>{renderActor(row)}</TableCell>
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
          {data ? ` · ${data.total}` : ''}
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
