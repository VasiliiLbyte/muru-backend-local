import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag, Trash2 } from 'lucide-react'

import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  SkeletonTable,
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirm,
  useToast,
} from '../../components/ui'
import {
  deletePromoCode,
  listPromoCodes,
  type AdminPromoCode,
} from '../../lib/promo-codes-api'
import {
  formatDiscountType,
  formatPromoPeriod,
  promoStatusBadgeVariant,
} from './promo-form-utils'

export const PromoCodesListPage = () => {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()

  const [items, setItems] = useState<AdminPromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listPromoCodes())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить промокоды')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onDelete = async (promo: AdminPromoCode, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const ok = await confirm({
      title: 'Удалить промокод?',
      message: `Код «${promo.code}» будет удалён без возможности восстановления.`,
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return

    setDeletingId(promo.id)
    try {
      await deletePromoCode(promo.id)
      await load()
      toast.success('Промокод удалён')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить промокод'
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Промокоды"
        actions={
          <Button type="button" onClick={() => navigate('/promo-codes/new')}>
            Создать
          </Button>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <SkeletonTable rows={8} cols={9} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Промокодов пока нет"
          action={
            <Button type="button" onClick={() => navigate('/promo-codes/new')}>
              Создать промокод
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              <TableHead>Код</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead numeric>Значение</TableHead>
              <TableHead numeric>Мин. сумма</TableHead>
              <TableHead>Период</TableHead>
              <TableHead>Использовано/Лимит</TableHead>
              <TableHead numeric>На пользователя</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((promo) => (
              <TableRow
                key={promo.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/promo-codes/${promo.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/promo-codes/${promo.id}`)
                  }
                }}
              >
                <TableCell>
                  <span className="muru-page-header__back">{promo.code}</span>
                </TableCell>
                <TableCell>{formatDiscountType(promo.discountType)}</TableCell>
                <TableCell numeric>
                  {promo.discountType === 'percent'
                    ? `${promo.discountValue}%`
                    : `${promo.discountValue} ₽`}
                </TableCell>
                <TableCell numeric>{promo.minOrderAmount} ₽</TableCell>
                <TableCell>{formatPromoPeriod(promo.startsAt, promo.expiresAt)}</TableCell>
                <TableCell>
                  {promo.usedCount} / {promo.usageLimit ?? '∞'}
                </TableCell>
                <TableCell numeric>{promo.usageLimitPerUser}</TableCell>
                <TableCell>
                  <Badge variant={promoStatusBadgeVariant(promo.status)}>{promo.status}</Badge>
                </TableCell>
                <TableCell>
                  <TableActions>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation()
                        navigate(`/promo-codes/${promo.id}/usages`)
                      }}
                    >
                      Использования
                    </Button>
                    <IconButton
                      aria-label="Удалить промокод"
                      variant="danger"
                      disabled={deletingId === promo.id}
                      onClick={(event) => void onDelete(promo, event)}
                    >
                      <Trash2 size={16} aria-hidden />
                    </IconButton>
                  </TableActions>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
