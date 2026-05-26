import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCart } from '../cart/CartContext'
import {
  calculateCdek,
  fetchCdekCities,
  fetchCdekPvz,
  type CdekCalcResult,
  type CdekCity,
  type CdekPvz,
  type CdekTariffOption,
} from '../lib/api'
import { pressable, pressableDisabled } from '../lib/uiClasses'

type CheckoutPageProps = {
  userId?: number
  onBackToCart: () => void
}

const formatEta = (option: CdekTariffOption | null | undefined): string => {
  if (!option || option.periodMin <= 0) return ''
  return `${option.periodMin}–${option.periodMax} дн.`
}

const formatCityLabel = (city: CdekCity) =>
  city.region ? `${city.city} (${city.region})` : city.city

export const CheckoutPage = ({ userId, onBackToCart }: CheckoutPageProps) => {
  const {
    items,
    checkout,
    updateCheckout,
    submitOrder,
    total,
    subtotal,
    discount,
    promoInput,
    setPromoInput,
    activatedPromo,
    promoError,
    applyPromo,
    clearPromo,
    persistDraft,
    isLoading,
    error,
  } = useCart()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [promoBusy, setPromoBusy] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [citySuggestions, setCitySuggestions] = useState<CdekCity[]>([])
  const [selectedCity, setSelectedCity] = useState<CdekCity | null>(null)
  const [deliveryType, setDeliveryType] = useState<'door' | 'pvz'>('door')
  const [pvzList, setPvzList] = useState<CdekPvz[]>([])
  const [selectedPvz, setSelectedPvz] = useState<CdekPvz | null>(null)
  const [calc, setCalc] = useState<CdekCalcResult | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [houseAddress, setHouseAddress] = useState('')

  const hasItems = useMemo(() => items.length > 0, [items.length])

  const selectedTariff = deliveryType === 'pvz' ? calc?.pvz : calc?.door

  const checkoutReady = useMemo(() => {
    if (!hasItems || calcLoading || !selectedCity) return false
    if (!selectedTariff) return false
    if (deliveryType === 'door' && !houseAddress.trim()) return false
    if (deliveryType === 'pvz' && !selectedPvz) return false
    return true
  }, [hasItems, calcLoading, selectedCity, selectedTariff, deliveryType, houseAddress, selectedPvz])

  useEffect(() => {
    if (selectedCity && selectedCity.full_name === cityQuery) return
    const q = cityQuery.trim()
    if (q.length < 2) {
      setCitySuggestions([])
      return
    }
    const timer = setTimeout(() => {
      fetchCdekCities(q)
        .then(setCitySuggestions)
        .catch(() => setCitySuggestions([]))
    }, 350)
    return () => clearTimeout(timer)
  }, [cityQuery, selectedCity])

  useEffect(() => {
    if (!selectedCity) {
      setPvzList([])
      setSelectedPvz(null)
      setCalc(null)
      return
    }

    let cancelled = false

    if (deliveryType === 'pvz') {
      fetchCdekPvz(selectedCity.code)
        .then((list) => {
          if (!cancelled) setPvzList(list)
        })
        .catch(() => {
          if (!cancelled) setPvzList([])
        })
    } else {
      setPvzList([])
      setSelectedPvz(null)
    }

    const calcTimer = setTimeout(() => {
      if (items.length === 0) return
      setCalcLoading(true)
      calculateCdek({
        toCityCode: selectedCity.code,
        items: items.map((item) => ({ sku: item.sku, quantity: item.quantity })),
      })
        .then((result) => {
          if (!cancelled) setCalc(result)
        })
        .catch(() => {
          if (!cancelled) setCalc({ door: null, pvz: null, errors: ['Не удалось рассчитать доставку'] })
        })
        .finally(() => {
          if (!cancelled) setCalcLoading(false)
        })
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(calcTimer)
    }
  }, [selectedCity, deliveryType, items])

  useEffect(() => {
    if (!selectedCity) return

    const deliveryPrice =
      deliveryType === 'pvz' ? (calc?.pvz?.deliverySum ?? 0) : (calc?.door?.deliverySum ?? 0)
    const deliveryEta =
      deliveryType === 'pvz' ? formatEta(calc?.pvz) : formatEta(calc?.door)
    const address =
      deliveryType === 'pvz'
        ? selectedPvz
          ? `${selectedCity.full_name}, ПВЗ: ${selectedPvz.address}`
          : selectedCity.full_name
        : houseAddress.trim()
          ? `${selectedCity.full_name}, ${houseAddress.trim()}`
          : selectedCity.full_name

    updateCheckout({
      deliveryMode: 'delivery',
      deliveryOption: deliveryType === 'pvz' ? `PVZ:${selectedPvz?.code ?? ''}` : 'DOOR',
      deliveryPrice,
      deliveryEta,
      address,
      cdekExtras: {
        cdekTariffCode:
          deliveryType === 'pvz' ? calc?.pvz?.tariffCode : calc?.door?.tariffCode,
        cdekCityCode: selectedCity.code,
        cdekCityName: selectedCity.full_name,
        cdekPvzCode: deliveryType === 'pvz' ? (selectedPvz?.code ?? null) : null,
        cdekPvzAddress: deliveryType === 'pvz' ? (selectedPvz?.address ?? null) : null,
      },
    })
  }, [selectedCity, deliveryType, selectedPvz, houseAddress, calc, updateCheckout])

  const handleConfirm = useCallback(async () => {
    if (isSubmitting || !checkoutReady) return
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
  }, [isSubmitting, checkoutReady, submitOrder, userId, onBackToCart])

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return

    webApp.MainButton.setText('Подтвердить заказ')
    if (checkoutReady && !isLoading && !isSubmitting) {
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
  }, [handleConfirm, checkoutReady, isLoading, isSubmitting])

  const selectCity = (city: CdekCity) => {
    setSelectedCity(city)
    setCityQuery(city.full_name)
    setCitySuggestions([])
    setSelectedPvz(null)
    setCalc(null)
  }

  return (
    <section className="space-y-3 pb-3">
      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h1 className="text-xl font-semibold text-muru-olive">Оформление заказа</h1>
        <p className="mt-2 text-sm">Заполните данные доставки и подтвердите заказ.</p>
      </div>

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h2 className="text-sm font-semibold text-muru-olive">Город доставки</h2>
        <input
          value={cityQuery}
          onChange={(event) => {
            setCityQuery(event.target.value)
            if (selectedCity && event.target.value !== selectedCity.full_name) {
              setSelectedCity(null)
            }
          }}
          placeholder="Начните вводить город"
          className="mt-2 w-full rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm"
        />
        {citySuggestions.length > 0 ? (
          <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto">
            {citySuggestions.map((city) => (
              <button
                key={`${city.code}-${city.full_name}`}
                type="button"
                className={`${pressable} rounded-lg bg-[#efe8d8] px-2 py-1 text-left text-xs`}
                onClick={() => selectCity(city)}
              >
                {formatCityLabel(city)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {selectedCity ? (
        <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
          <h2 className="text-sm font-semibold text-muru-olive">Способ доставки</h2>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={`${pressable} rounded-xl px-3 py-2 text-sm ${
                deliveryType === 'door' ? 'bg-muru-olive text-muru-ivory' : 'bg-[#efe8d8]'
              }`}
              onClick={() => setDeliveryType('door')}
            >
              До двери
            </button>
            <button
              type="button"
              className={`${pressable} rounded-xl px-3 py-2 text-sm ${
                deliveryType === 'pvz' ? 'bg-muru-olive text-muru-ivory' : 'bg-[#efe8d8]'
              }`}
              onClick={() => setDeliveryType('pvz')}
            >
              До ПВЗ
            </button>
          </div>

          {deliveryType === 'door' ? (
            <div className="mt-3">
              <label className="text-xs font-medium text-muru-olive" htmlFor="house-address">
                Улица, дом, квартира
              </label>
              <input
                id="house-address"
                value={houseAddress}
                onChange={(event) => setHouseAddress(event.target.value)}
                placeholder="Например: Невский пр., 1, кв. 10"
                className="mt-1 w-full rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto">
              {pvzList.length === 0 ? (
                <p className="text-xs text-[#6b6b4a]">
                  {calcLoading ? 'Загрузка пунктов…' : 'Пункты выдачи не найдены'}
                </p>
              ) : (
                pvzList.map((pvz) => (
                  <button
                    key={pvz.code}
                    type="button"
                    className={`${pressable} rounded-xl border px-3 py-2 text-left text-sm ${
                      selectedPvz?.code === pvz.code
                        ? 'border-muru-olive bg-[#efe8d8]'
                        : 'border-muru-accent'
                    }`}
                    onClick={() => setSelectedPvz(pvz)}
                  >
                    <p className="font-medium">{pvz.name}</p>
                    <p className="text-xs">{pvz.address}</p>
                    {pvz.workTime ? <p className="text-xs text-[#6b6b4a]">{pvz.workTime}</p> : null}
                  </button>
                ))
              )}
            </div>
          )}

          {calcLoading ? (
            <p className="mt-3 text-xs text-[#6b6b4a]">Расчёт стоимости доставки…</p>
          ) : null}
          {calc?.errors && calc.errors.length > 0 ? (
            <p className="mt-2 text-xs text-red-700">{calc.errors.join('; ')}</p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <label className="text-sm font-semibold text-muru-olive" htmlFor="checkout-promo">
          Промокод
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="checkout-promo"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            placeholder="Введите промокод"
            className="min-w-0 flex-1 rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm uppercase"
            disabled={isLoading || promoBusy || isSubmitting}
          />
          <button
            type="button"
            className={`${pressableDisabled} shrink-0 rounded-xl bg-muru-olive px-3 py-2 text-xs font-medium text-muru-ivory`}
            disabled={isLoading || promoBusy || isSubmitting}
            onClick={async () => {
              setPromoBusy(true)
              try {
                await applyPromo()
              } finally {
                setPromoBusy(false)
              }
            }}
          >
            Применить
          </button>
        </div>
        {promoError ? <p className="mt-2 text-xs text-red-700">{promoError}</p> : null}
        {activatedPromo ? (
          <div className="mt-2 flex items-center justify-between text-xs text-[#8f2b2b]">
            <span>
              {activatedPromo.code}: −{activatedPromo.discount.toFixed(2)} ₽
            </span>
            <button type="button" className={`${pressable} underline`} onClick={clearPromo}>
              Сбросить
            </button>
          </div>
        ) : null}
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
        <p>Доставка: {checkout.deliveryPrice.toFixed(2)} ₽</p>
        {checkout.deliveryEta ? <p className="text-xs text-[#6b6b4a]">Срок: {checkout.deliveryEta}</p> : null}
        <p className="mt-1 font-semibold">Итого: {total.toFixed(2)} ₽</p>
      </div>

      {selectedCity && calc ? (
        <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-3 text-xs">
          <p
            className={
              deliveryType === 'door' ? 'font-semibold text-muru-olive' : 'text-[#6b6b4a]'
            }
          >
            До двери:{' '}
            {calc.door
              ? `${calc.door.deliverySum.toFixed(0)} ₽, ${formatEta(calc.door)}`
              : 'недоступно'}
          </p>
          <p
            className={
              deliveryType === 'pvz' ? 'mt-1 font-semibold text-muru-olive' : 'mt-1 text-[#6b6b4a]'
            }
          >
            До ПВЗ:{' '}
            {calc.pvz
              ? `${calc.pvz.deliverySum.toFixed(0)} ₽, ${formatEta(calc.pvz)}`
              : 'недоступно'}
          </p>
        </div>
      ) : null}

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
          disabled={isLoading || isSubmitting || !checkoutReady}
          onClick={handleConfirm}
        >
          Подтвердить заказ
        </button>
      </div>
    </section>
  )
}
