import { useMemo, useState } from 'react'

import { useCart } from '../cart/CartContext'
import { HeartGlyph } from '../components/Glyphs'
import { SmartImage } from '../components/SmartImage'
import { formatPrice } from '../lib/format'
import { pressable, pressableDisabled, cardSurface } from '../lib/uiClasses'

type CartPageProps = {
  userId?: number
  onGoCatalog: () => void
  onCheckout: () => void
}

export const CartPage = ({ userId, onGoCatalog, onCheckout }: CartPageProps) => {
  const {
    items,
    subtotal,
    discount,
    total,
    promoInput,
    setPromoInput,
    activatedPromo,
    promoError,
    isLoading,
    updateQuantity,
    removeItem,
    persistDraft,
    applyPromo,
    clearPromo,
  } = useCart()

  const [promoBusy, setPromoBusy] = useState(false)

  const hasItems = useMemo(() => items.length > 0, [items.length])

  const handleApplyPromo = async () => {
    setPromoBusy(true)
    try {
      await applyPromo()
    } finally {
      setPromoBusy(false)
    }
  }

  if (!hasItems) {
    return (
      <section
        className={`${cardSurface} flex min-h-[70vh] flex-col items-center justify-center p-6 text-center`}
      >
        <HeartGlyph className="h-16 w-16 text-muru-olive" />
        <h1 className="mt-4 font-muru-display text-[1.7rem] font-medium text-muru-olive">Корзина пуста</h1>
        <p className="mt-2 text-sm text-[#6f6666]">Добавьте товары, чтобы перейти к оформлению заказа.</p>
        <button
          type="button"
          className={`${pressable} mt-5 rounded-xl bg-muru-olive-soft px-6 py-2.5 text-sm font-medium tracking-wide text-muru-ivory`}
          onClick={onGoCatalog}
        >
          Перейти в каталог
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-4 pb-3">
      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h1 className="text-4xl font-semibold text-[#5e5252]">Корзина</h1>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            placeholder="Промокод"
            className="min-w-0 flex-1 rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm uppercase"
            disabled={isLoading || promoBusy}
          />
          <button
            type="button"
            className={`${pressableDisabled} shrink-0 rounded-xl bg-[#8f2b2b] px-3 py-2 text-xs font-semibold text-[#fff5ef]`}
            disabled={isLoading || promoBusy}
            onClick={() => void handleApplyPromo()}
          >
            Применить
          </button>
        </div>
        {promoError ? <p className="mt-2 text-xs text-red-700">{promoError}</p> : null}
        {activatedPromo ? (
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[#8f2b2b]">
            <span>
              Промокод {activatedPromo.code}: −{formatPrice(activatedPromo.discount)}
            </span>
            <button type="button" className={`${pressable} underline`} onClick={clearPromo}>
              Сбросить
            </button>
          </div>
        ) : null}
      </div>

      {items.map((item) => (
        <article key={item.sku} className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-3">
          <div className="flex gap-3">
            <SmartImage
              src={item.imageUrl ?? 'https://placehold.co/72x72?text=MURU'}
              alt={item.name}
              className="h-[72px] w-[72px] rounded-lg bg-[#f3ead7] object-cover"
            />
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-[#3f3636]">{item.name}</h2>
              <p className="mt-1 text-xs text-[#6f6666]">Цена/шт</p>
              <p className="text-xl font-semibold text-[#3f3636] tabular-nums">{formatPrice(item.price)}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              className={`${pressable} h-10 w-10 rounded-xl bg-[#efe8d8] text-xl`}
              onClick={() => updateQuantity(item.sku, item.quantity - 1)}
            >
              -
            </button>
            <div className="min-w-[72px] rounded-xl bg-[#f5efe3] px-3 py-2 text-center text-sm font-medium">
              {item.quantity} шт
            </div>
            <button
              type="button"
              className={`${pressable} h-10 w-10 rounded-xl bg-[#efe8d8] text-xl`}
              onClick={() => updateQuantity(item.sku, item.quantity + 1)}
            >
              +
            </button>
            <button
              type="button"
              className={`${pressable} ml-auto rounded-xl bg-[#efe8d8] px-3 py-2 text-xs`}
              onClick={() => removeItem(item.sku)}
            >
              Удалить
            </button>
          </div>
        </article>
      ))}

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span>Товары</span>
            <span className="tabular-nums">{formatPrice(subtotal)}</span>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between text-[#8f2b2b]">
              <span>Скидка</span>
              <span className="tabular-nums">− {formatPrice(discount)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between font-semibold text-lg">
            <span>Итого</span>
            <span className="tabular-nums">{formatPrice(total)}</span>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            className={`${pressableDisabled} rounded-xl bg-[#efe8d8] px-4 py-2 text-sm font-medium`}
            disabled={isLoading}
            onClick={() => persistDraft(userId)}
          >
            Сохранить черновик
          </button>
          <button
            type="button"
            className={`${pressableDisabled} rounded-xl bg-[#b91c1c] px-4 py-4 text-base font-semibold text-[#fff5ef]`}
            disabled={isLoading}
            onClick={async () => {
              await persistDraft(userId)
              onCheckout()
            }}
          >
            Оформить заказ
          </button>
        </div>
      </div>
    </section>
  )
}
