import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCart } from '../cart/CartContext'
import { pressable, pressableDisabled } from '../lib/uiClasses'

type CheckoutPageProps = {
  userId?: number
  onBackToCart: () => void
}

const mockAddressSuggestions = [
  'Санкт-Петербург, Невский проспект, 38',
  'Санкт-Петербург, Лиговский проспект, 50',
  'Санкт-Петербург, Большой проспект П.С., 18',
  'Санкт-Петербург, Московский проспект, 103',
]

const cdekOptions = [
  { label: 'Супер-экспресс', code: 'super-express', price: 890, eta: 'сегодня до 22:00' },
  { label: 'Экспресс склад-дверь', code: 'express-warehouse-door', price: 540, eta: '1-2 дня' },
  { label: 'Экспресс склад-склад', code: 'express-warehouse-warehouse', price: 390, eta: '1-2 дня' },
  { label: 'Посылка склад-дверь', code: 'parcel-warehouse-door', price: 320, eta: '2-4 дня' },
]

export const CheckoutPage = ({ userId, onBackToCart }: CheckoutPageProps) => {
  const {
    items,
    checkout,
    updateCheckout,
    submitOrder,
    total,
    subtotal,
    discount,
    promoCode,
    isPromoActive,
    persistDraft,
    isLoading,
    error,
  } = useCart()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hasItems = useMemo(() => items.length > 0, [items.length])

  const handleConfirm = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const createdOrder = await submitOrder(userId)
      console.log('[checkout-confirmed]', {
        orderId: createdOrder.id,
        total: createdOrder.total,
        deliveryMode: createdOrder.deliveryMode,
        deliveryOption: createdOrder.deliveryOption,
      })
      alert(`Заказ №${createdOrder.id} принят. Ожидайте звонка менеджера`)
      onBackToCart()
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, submitOrder, userId, onBackToCart])

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return

    webApp.MainButton.setText('Подтвердить заказ')
    if (hasItems && !isLoading && !isSubmitting) {
      webApp.MainButton.enable()
    } else {
      webApp.MainButton.disable()
    }
    webApp.MainButton.show()
    webApp.MainButton.onClick(handleConfirm)

    return () => {
      webApp.MainButton.offClick(handleConfirm)
      webApp.MainButton.hide()
    }
  }, [handleConfirm, hasItems, isLoading, isSubmitting])

  return (
    <section className="space-y-3 pb-3">
      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h1 className="text-xl font-semibold text-muru-olive">Оформление заказа</h1>
        <p className="mt-2 text-sm">Заполните данные доставки и подтвердите заказ.</p>
      </div>

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h2 className="text-sm font-semibold text-muru-olive">Адрес доставки</h2>
        <input
          value={checkout.address}
          onChange={(event) => updateCheckout({ address: event.target.value })}
          placeholder="Введите адрес"
          className="mt-2 w-full rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm"
        />
        <div className="mt-2 grid gap-1">
          {mockAddressSuggestions.map((item) => (
            <button
              key={item}
              type="button"
              className={`${pressable} rounded-lg bg-[#efe8d8] px-2 py-1 text-left text-xs`}
              onClick={() => updateCheckout({ address: item })}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h2 className="text-sm font-semibold text-muru-olive">Способ получения</h2>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={`${pressable} rounded-xl px-3 py-2 text-sm ${
              checkout.deliveryMode === 'delivery' ? 'bg-muru-olive text-muru-ivory' : 'bg-[#efe8d8]'
            }`}
            onClick={() => updateCheckout({ deliveryMode: 'delivery' })}
          >
            Доставка
          </button>
          <button
            type="button"
            className={`${pressable} rounded-xl px-3 py-2 text-sm ${
              checkout.deliveryMode === 'pickup' ? 'bg-muru-olive text-muru-ivory' : 'bg-[#efe8d8]'
            }`}
            onClick={() => updateCheckout({ deliveryMode: 'pickup', deliveryPrice: 0, deliveryEta: 'Самовывоз сегодня' })}
          >
            Самовывоз
          </button>
        </div>

        {checkout.deliveryMode === 'delivery' ? (
          <div className="mt-3 grid gap-2">
            {cdekOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                className={`${pressable} rounded-xl border px-3 py-2 text-left text-sm ${
                  checkout.deliveryOption === option.label ? 'border-muru-olive bg-[#efe8d8]' : 'border-muru-accent'
                }`}
                onClick={() =>
                  updateCheckout({
                    deliveryOption: option.label,
                    deliveryPrice: option.price,
                    deliveryEta: option.eta,
                  })
                }
              >
                <p className="font-medium">{option.label}</p>
                <p className="text-xs">
                  {option.price.toFixed(2)} ₽, срок: {option.eta}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm">Самовывоз из шоурума MURU (бесплатно).</p>
        )}
      </div>

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <label className="text-sm font-semibold text-muru-olive" htmlFor="checkout-promo">
          Промокод
        </label>
        <input
          id="checkout-promo"
          value={isPromoActive ? promoCode : ''}
          readOnly
          placeholder="Промокод не активирован"
          className="mt-2 w-full rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <label className="text-sm font-semibold text-muru-olive" htmlFor="checkout-comment">
          Комментарий
        </label>
        <textarea
          id="checkout-comment"
          value={checkout.comment}
          onChange={(event) => updateCheckout({ comment: event.target.value })}
          className="mt-2 min-h-20 w-full rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm"
          placeholder="Комментарий к заказу"
        />

        <label className="mt-3 block text-sm font-semibold text-muru-olive" htmlFor="checkout-birthdate">
          Дата рождения (опционально)
        </label>
        <input
          id="checkout-birthdate"
          type="date"
          value={checkout.birthDate}
          onChange={(event) => updateCheckout({ birthDate: event.target.value })}
          className="mt-2 w-full rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4 text-sm">
        <p>Товары: {subtotal.toFixed(2)} ₽</p>
        <p>Скидка: - {discount.toFixed(2)} ₽</p>
        <p>Доставка: {(checkout.deliveryMode === 'pickup' ? 0 : checkout.deliveryPrice).toFixed(2)} ₽</p>
        <p className="mt-1 font-semibold">Итого: {total.toFixed(2)} ₽</p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-2">
        <button
          type="button"
          className={`${pressable} rounded-xl bg-[#efe8d8] px-4 py-2 text-sm font-medium`}
          onClick={onBackToCart}
        >
          Вернуться в корзину
        </button>
        <button
          type="button"
          className={`${pressableDisabled} rounded-xl bg-[#e3dccd] px-4 py-2 text-sm font-medium`}
          disabled={isLoading || isSubmitting || !hasItems}
          onClick={() => persistDraft(userId)}
        >
          Сохранить черновик
        </button>
        <button
          type="button"
          className={`${pressableDisabled} rounded-xl bg-muru-olive px-4 py-3 text-sm font-semibold text-muru-ivory`}
          disabled={isLoading || isSubmitting || !hasItems}
          onClick={handleConfirm}
        >
          Подтвердить заказ
        </button>
      </div>
    </section>
  )
}
