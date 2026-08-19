import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { History } from 'lucide-react'

import {
  EmptyState,
  PageHeader,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui'
import {
  listPromoCodeUsages,
  listPromoCodes,
  type AdminPromoCodeUsage,
} from '../../lib/promo-codes-api'

const formatUsedAt = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatTelegramUserId = (value: number | null): string => {
  if (value === 0) return 'Guest (web)'
  if (value == null) return '—'
  return String(value)
}

export const PromoCodeUsagesPage = () => {
  const { id } = useParams()
  const promoId = id ? Number.parseInt(id, 10) : NaN
  const validPromoId = Number.isInteger(promoId) && promoId > 0 ? promoId : null

  const [code, setCode] = useState('')
  const [items, setItems] = useState<AdminPromoCodeUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (validPromoId == null) {
      setError('Некорректный идентификатор промокода')
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [promos, usages] = await Promise.all([
          listPromoCodes(),
          listPromoCodeUsages(validPromoId),
        ])
        const promo = promos.find((item) => item.id === validPromoId)
        setCode(promo?.code ?? `#${validPromoId}`)
        setItems(usages)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить использования')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [validPromoId])

  return (
    <section className="page-stack">
      <PageHeader title={`Использования: ${code}`} backTo="/promo-codes" backLabel="К списку" />

      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : items.length === 0 ? (
        <EmptyState icon={History} title="Использований пока нет" />
      ) : (
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              <TableHead>ID</TableHead>
              <TableHead>Telegram ID</TableHead>
              <TableHead>Customer ID</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Дата</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((usage) => (
              <TableRow key={usage.id} hover={false}>
                <TableCell>{usage.id}</TableCell>
                <TableCell>{formatTelegramUserId(usage.telegramUserId)}</TableCell>
                <TableCell>{usage.customerId ?? '—'}</TableCell>
                <TableCell>
                  {usage.orderId != null ? (
                    <Link className="muru-page-header__back" to={`/orders/${usage.orderId}`}>
                      #{usage.orderId}
                    </Link>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>{formatUsedAt(usage.usedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
