import { Badge } from '../components/ui'
import { cn } from '../lib/cn'

const STATUS_CLASS: Record<string, string> = {
  Новый: 'order-status--novyj',
  Собирается: 'order-status--assembling',
  'В пути': 'order-status--vputi',
  Доставлен: 'order-status--delivered',
  Отменён: 'order-status--cancelled',
  Возврат: 'order-status--returned',
  Черновик: 'order-status--draft',
}

export const orderStatusBadgeClass = (status: string): string =>
  STATUS_CLASS[status] ?? 'order-status--fallback'

export const OrderStatusBadge = ({ status }: { status: string }) => (
  <Badge variant="neutral" className={cn('order-status-chip', orderStatusBadgeClass(status))}>
    {status}
  </Badge>
)
