import { formatPrice } from '../lib/format'
import { getStatusPill } from '../lib/orderStatus'
import { pressable, cardSurface } from '../lib/uiClasses'
import type { OrderHistoryItem } from '../types/cart'

export function OrderDetailPage({ order, onBack }: { order: OrderHistoryItem; onBack: () => void }) {
  const pill = getStatusPill(order.status)
  const isPvz = Boolean(order.cdekPvzAddress)
  const track = order.cdekTrackNumber
  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className={`${pressable} inline-flex items-center gap-1 text-sm text-muru-olive`}
      >
        ← Назад
      </button>

      <div className={`${cardSurface} p-5`}>
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-muru-display text-[1.5rem] font-medium text-muru-olive">Заказ №{order.id}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs tracking-wide ${pill.className}`}>{pill.label}</span>
        </div>
        <p className="mt-1 text-xs text-[#8a7f6d]">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</p>
      </div>

      <div className={`${cardSurface} p-4`}>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muru-olive">Состав</h2>
        <ul className="mt-3 space-y-2">
          {order.items.map((it) => (
            <li
              key={`${it.sku}-${it.color ?? ''}-${it.size ?? ''}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <span className="min-w-0">
                <span className="text-muru-text">{it.name}</span>
                {it.color || it.size ? (
                  <span className="text-xs text-[#8a7f6d]"> · {[it.color, it.size].filter(Boolean).join(' · ')}</span>
                ) : null}
                <span className="text-xs text-[#8a7f6d]"> × {it.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatPrice(it.price * it.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={`${cardSurface} p-4`}>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muru-olive">Доставка</h2>
        <div className="mt-2 space-y-1 text-sm text-muru-text">
          <p>{isPvz ? 'Пункт выдачи СДЭК' : 'Курьер СДЭК'}</p>
          {isPvz ? (
            <p className="text-[#6f6655]">{order.cdekPvzAddress}</p>
          ) : order.address ? (
            <p className="text-[#6f6655]">{order.address}</p>
          ) : null}
          {order.deliveryEta ? <p className="text-xs text-[#8a7f6d]">Срок: {order.deliveryEta}</p> : null}
          {order.cdekRecipientName ? (
            <p className="text-xs text-[#8a7f6d]">
              Получатель: {order.cdekRecipientName}
              {order.cdekRecipientPhone ? `, ${order.cdekRecipientPhone}` : ''}
            </p>
          ) : null}
        </div>
        {track ? (
          <div className="mt-3 rounded-lg bg-[#efe8d8]/60 p-3 text-sm">
            <p className="text-muru-text">
              Трек-номер СДЭК: <span className="font-medium tabular-nums">{track}</span>
            </p>
            <a
              href={`https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(track)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${pressable} mt-2 inline-block rounded-lg bg-muru-olive-soft px-4 py-2 text-xs font-medium tracking-wide text-muru-ivory`}
            >
              Отследить
            </a>
          </div>
        ) : null}
      </div>

      <div className={`${cardSurface} p-4`}>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muru-olive">Итого</h2>
        <div className="mt-2 space-y-1 text-sm">
          {typeof order.subtotal === 'number' ? (
            <div className="flex justify-between">
              <span className="text-[#6f6655]">Товары</span>
              <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
            </div>
          ) : null}
          {order.promoDiscount ? (
            <div className="flex justify-between">
              <span className="text-[#6f6655]">Скидка</span>
              <span className="tabular-nums">− {formatPrice(order.promoDiscount)}</span>
            </div>
          ) : null}
          {typeof order.deliveryPrice === 'number' ? (
            <div className="flex justify-between">
              <span className="text-[#6f6655]">Доставка</span>
              <span className="tabular-nums">{formatPrice(order.deliveryPrice)}</span>
            </div>
          ) : null}
          <div className="flex justify-between pt-1 font-medium">
            <span>Итого</span>
            <span className="tabular-nums">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
