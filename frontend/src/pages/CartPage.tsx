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
    <section className="space-y-3">
      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h1 className="text-xl font-semibold text-muru-olive">Корзина</h1>
        {!hasItems ? <p className="mt-2 text-sm">Корзина пока пустая.</p> : null}
      </div>

      {items.map((item) => (
        <article key={item.sku} className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-3">
          <h2 className="text-sm font-semibold">{item.name}</h2>
          <p className="mt-1 text-sm">{item.price.toFixed(2)} ₽</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-[#efe8d8] px-2 py-1"
              onClick={() => updateQuantity(item.sku, item.quantity - 1)}
            >
              -
            </button>
            <span className="text-sm">{item.quantity}</span>
            <button
              type="button"
              className="rounded-lg bg-[#efe8d8] px-2 py-1"
              onClick={() => updateQuantity(item.sku, item.quantity + 1)}
            >
              +
            </button>
            <button
              type="button"
              className="ml-auto rounded-lg bg-[#e3dccd] px-2 py-1 text-xs"
              onClick={() => removeItem(item.sku)}
            >
              Удалить
            </button>
          </div>
        </article>
      ))}

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <p className="text-sm font-medium">Итоговая сумма: {subtotal.toFixed(2)} ₽</p>
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
            onClick={onCheckout}
          >
            Оформить заказ
          </button>
        </div>
      </div>
    </section>
  )
}
