import { useEffect, useState } from 'react'

import { OrderCard } from '../components/OrderCard'
import { ReceiptGlyph } from '../components/Glyphs'
import { fetchMyOrders } from '../lib/api'
import { pressable, cardSurface } from '../lib/uiClasses'
import type { OrderHistoryItem } from '../types/cart'

export function MyOrdersPage({
  userId,
  onBack,
  onOpenOrderDetail,
  onGoCatalog,
}: {
  userId?: number
  onBack: () => void
  onOpenOrderDetail: (o: OrderHistoryItem) => void
  onGoCatalog: () => void
}) {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchMyOrders(userId)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className={`${pressable} inline-flex items-center gap-1 text-sm text-muru-olive`}
      >
        ← Назад
      </button>
      <h1 className="font-muru-display text-[1.6rem] font-medium text-muru-olive">Мои заказы</h1>
      {loading ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#efe8d8]" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className={`${cardSurface} p-6 text-center`}>
          <ReceiptGlyph className="mx-auto h-12 w-12 text-muru-olive" />
          <p className="mt-3 text-sm">Заказов пока нет</p>
          <button
            type="button"
            onClick={onGoCatalog}
            className={`${pressable} mt-4 rounded-xl bg-muru-olive-soft px-5 py-2 text-sm font-medium tracking-wide text-muru-ivory`}
          >
            Перейти в каталог
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onOpen={onOpenOrderDetail} />
          ))}
        </div>
      )}
    </section>
  )
}
