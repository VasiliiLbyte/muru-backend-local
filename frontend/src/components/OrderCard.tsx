import { formatPrice } from '../lib/format'
import { getStatusPill } from '../lib/orderStatus'
import { pressable, cardSurface } from '../lib/uiClasses'
import type { OrderHistoryItem } from '../types/cart'

export function OrderCard({ order, onOpen }: { order: OrderHistoryItem; onOpen: (o: OrderHistoryItem) => void }) {
  const pill = getStatusPill(order.status)
  return (
    <button
      type="button"
      onClick={() => onOpen(order)}
      className={`${pressable} ${cardSurface} flex w-full items-center gap-3 p-3 text-left transition-shadow hover:shadow-[0_4px_16px_rgba(60,55,40,0.09)]`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muru-text">Заказ №{order.id}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] tracking-wide ${pill.className}`}>{pill.label}</span>
        </div>
        <p className="mt-0.5 text-xs text-[#8a7f6d]">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</p>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-muru-text">{formatPrice(order.total)}</span>
      <span className="shrink-0 text-muru-accent">›</span>
    </button>
  )
}
