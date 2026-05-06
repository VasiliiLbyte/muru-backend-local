import { useMemo } from 'react'

import { useCart } from '../cart/CartContext'

type CartPageProps = {
  userId?: number
  onCheckout: () => void
}

export const CartPage = ({ userId, onCheckout }: CartPageProps) => {
  const { items, subtotal, isLoading, updateQuantity, removeItem, persistDraft } = useCart()

  const hasItems = useMemo(() => items.length > 0, [items.length])

  return (
    <section className="space-y-4 pb-3">
      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h1 className="text-4xl font-semibold text-[#5e5252]">Корзина</h1>
        {!hasItems ? <p className="mt-2 text-sm text-[#6f6666]">Здесь пока пусто. Добавьте товары из каталога.</p> : null}
      </div>

      {items.map((item) => (
        <article key={item.sku} className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-3">
          <h2 className="text-sm font-semibold text-[#3f3636]">{item.name}</h2>
          <p className="mt-1 text-sm text-[#6f6666]">Цена/шт</p>
          <p className="text-xl font-semibold text-[#3f3636]">{item.price.toFixed(1)} ₽</p>
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              className="h-10 w-10 rounded-xl bg-[#efe8d8] text-xl"
              onClick={() => updateQuantity(item.sku, item.quantity - 1)}
            >
              -
            </button>
            <div className="min-w-[72px] rounded-xl bg-[#f5efe3] px-3 py-2 text-center text-sm font-medium">
              {item.quantity} шт
            </div>
            <button
              type="button"
              className="h-10 w-10 rounded-xl bg-[#efe8d8] text-xl"
              onClick={() => updateQuantity(item.sku, item.quantity + 1)}
            >
              +
            </button>
            <button
              type="button"
              className="ml-auto rounded-xl bg-[#efe8d8] px-3 py-2 text-xs"
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
            <span>{subtotal.toFixed(1)} ₽</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-lg">
            <span>Итого</span>
            <span>{subtotal.toFixed(1)} ₽</span>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            className="rounded-xl bg-[#efe8d8] px-4 py-2 text-sm font-medium"
            disabled={isLoading}
            onClick={() => persistDraft(userId)}
          >
            Сохранить черновик
          </button>
          <button
            type="button"
            className="rounded-xl bg-muru-olive px-4 py-3 text-sm font-semibold text-muru-ivory"
            disabled={!hasItems || isLoading}
            onClick={async () => {
              await persistDraft(userId)
              onCheckout()
            }}
          >
            Перейти к оформлению
          </button>
        </div>
      </div>
    </section>
  )
}
