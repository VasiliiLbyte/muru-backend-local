import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCart } from '../cart/CartContext'
import {
  calculateCdek,
  createPayment,
  fetchAddressSuggestions,
  fetchCdekCities,
  fetchCdekPvz,
  fetchMyProfile,
  type AddressSuggestion,
  type CdekCalcResult,
  type CdekCity,
  type CdekPvz,
  type CdekTariffOption,
} from '../lib/api'
import { formatPrice } from '../lib/format'
import { pressable, pressableDisabled } from '../lib/uiClasses'

type CheckoutPageProps = {
  userId?: number
  onBackToCart: () => void
  onOpenLegal: (doc: 'terms' | 'privacy') => void
}

const formatEta = (option: CdekTariffOption | null | undefined): string => {
  if (!option || option.periodMin <= 0) return ''
  return `${option.periodMin}–${option.periodMax} дн.`
}

const formatCityLabel = (city: CdekCity) => {
  const name = (city.city || city.full_name || '').trim()
  if (!name) return `Город ${city.code}`
  if (city.region) return `${name} (${city.region})`
  return city.full_name.trim() || name
}

export const CheckoutPage = ({ userId, onBackToCart, onOpenLegal }: CheckoutPageProps) => {
  const {
    items,
    checkout,
    updateCheckout,
    buildPaymentSnapshot,
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
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [promoBusy, setPromoBusy] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [citySuggestions, setCitySuggestions] = useState<CdekCity[]>([])
  const [cityLookupState, setCityLookupState] = useState<
    'idle' | 'loading' | 'empty' | 'error'
  >('idle')
  const [selectedCity, setSelectedCity] = useState<CdekCity | null>(null)
  const [deliveryType, setDeliveryType] = useState<'door' | 'pvz'>('door')
  const [pvzList, setPvzList] = useState<CdekPvz[]>([])
  const [selectedPvz, setSelectedPvz] = useState<CdekPvz | null>(null)
  const [calc, setCalc] = useState<CdekCalcResult | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [streetQuery, setStreetQuery] = useState('')
  const [streetSuggestions, setStreetSuggestions] = useState<AddressSuggestion[]>([])
  const [streetLookupState, setStreetLookupState] = useState<
    'idle' | 'loading' | 'empty' | 'error' | 'disabled'
  >('idle')
  const [selectedStreetValue, setSelectedStreetValue] = useState('')
  const [flat, setFlat] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [draftHydrated, setDraftHydrated] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(false)

  const houseAddress = useMemo(() => {
    const street = selectedStreetValue.trim() || streetQuery.trim()
    if (!street) return ''
    const flatTrimmed = flat.trim()
    return flatTrimmed ? `${street}, кв ${flatTrimmed}` : street
  }, [selectedStreetValue, streetQuery, flat])

  const hasItems = useMemo(() => items.length > 0, [items.length])

  const selectedTariff = deliveryType === 'pvz' ? calc?.pvz : calc?.door

  const checkoutReady = useMemo(() => {
    if (!consentAccepted) return false
    if (!hasItems || calcLoading || !selectedCity) return false
    if (!selectedTariff) return false
    if (recipientName.trim().length < 2) return false
    const phoneDigits = recipientPhone.replace(/\D/g, '')
    if (phoneDigits.length !== 10 && phoneDigits.length !== 11) return false
    if (deliveryType === 'door') {
      const street = selectedStreetValue.trim() || streetQuery.trim()
      if (street.length < 3) return false
    }
    if (deliveryType === 'pvz' && !selectedPvz) return false
    return true
  }, [
    consentAccepted,
    hasItems,
    calcLoading,
    selectedCity,
    selectedTariff,
    deliveryType,
    selectedStreetValue,
    streetQuery,
    selectedPvz,
    recipientName,
    recipientPhone,
  ])

  useEffect(() => {
    if (!userId) return
    fetchMyProfile(userId)
      .then((profile) => {
        setRecipientName((prev) => (prev.trim() ? prev : profile.fullName))
        setRecipientPhone((prev) => (prev.trim() ? prev : profile.phone))
      })
      .catch(() => undefined)
  }, [userId])

  useEffect(() => {
    if (draftHydrated) return
    const extras = checkout.cdekExtras
    if (!extras?.cdekCityCode) return

    const city: CdekCity = {
      code: extras.cdekCityCode,
      full_name: extras.cdekCityName ?? '',
      city: extras.cdekCityName ?? '',
      region: '',
    }
    setSelectedCity(city)
    setCityQuery(city.full_name)

    const isPvz = checkout.deliveryOption.startsWith('PVZ:')
    setDeliveryType(isPvz ? 'pvz' : 'door')

    if (checkout.recipientName) setRecipientName(checkout.recipientName)
    if (checkout.recipientPhone) setRecipientPhone(checkout.recipientPhone)

    if (!isPvz && checkout.address.includes(',')) {
      const parts = checkout.address.split(',').slice(1).join(',').trim()
      if (parts.startsWith('ПВЗ:')) {
        // skip
      } else if (parts) {
        const flatMatch = parts.match(/,\s*кв\s*([^,]+)\s*$/i)
        if (flatMatch) {
          const streetPart = parts.slice(0, flatMatch.index).trim()
          setSelectedStreetValue(streetPart)
          setStreetQuery(streetPart)
          setFlat(flatMatch[1].trim())
        } else {
          setSelectedStreetValue(parts)
          setStreetQuery(parts)
        }
      }
    }

    if (isPvz && extras.cdekPvzCode) {
      void fetchCdekPvz(extras.cdekCityCode).then((list) => {
        setPvzList(list)
        const found = list.find((p) => p.code === extras.cdekPvzCode)
        if (found) setSelectedPvz(found)
      })
    }

    setDraftHydrated(true)
  }, [checkout, draftHydrated])

  useEffect(() => {
    if (selectedCity && selectedCity.full_name === cityQuery) return
    const q = cityQuery.trim()
    if (q.length < 2) {
      setCitySuggestions([])
      setCityLookupState('idle')
      return
    }
    setCityLookupState('loading')
    const timer = setTimeout(() => {
      fetchCdekCities(q)
        .then((list) => {
          setCitySuggestions(list)
          setCityLookupState(list.length === 0 ? 'empty' : 'idle')
        })
        .catch(() => {
          setCitySuggestions([])
          setCityLookupState('error')
        })
    }, 350)
    return () => clearTimeout(timer)
  }, [cityQuery, selectedCity])

  useEffect(() => {
    if (deliveryType !== 'door') {
      setStreetSuggestions([])
      setStreetLookupState('idle')
      return
    }
    if (!selectedCity) {
      setStreetSuggestions([])
      setStreetLookupState('idle')
      return
    }
    if (selectedStreetValue && selectedStreetValue === streetQuery) {
      setStreetSuggestions([])
      setStreetLookupState('idle')
      return
    }
    const q = streetQuery.trim()
    if (q.length < 3) {
      setStreetSuggestions([])
      setStreetLookupState('idle')
      return
    }
    setStreetLookupState('loading')
    const timer = setTimeout(() => {
      fetchAddressSuggestions(q, selectedCity.city || selectedCity.full_name)
        .then((list) => {
          setStreetSuggestions(list)
          if (list.length === 0) {
            setStreetLookupState('disabled')
          } else {
            setStreetLookupState('idle')
          }
        })
        .catch(() => {
          setStreetSuggestions([])
          setStreetLookupState('error')
        })
    }, 350)
    return () => clearTimeout(timer)
  }, [deliveryType, selectedCity, streetQuery, selectedStreetValue])

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
    const street = houseAddress.trim()
    const address =
      deliveryType === 'pvz'
        ? selectedPvz
          ? `${selectedCity.full_name}, ПВЗ: ${selectedPvz.address}`
          : selectedCity.full_name
        : street
          ? `${selectedCity.full_name}, ${street}`
          : selectedCity.full_name

    updateCheckout({
      deliveryMode: 'delivery',
      deliveryOption: deliveryType === 'pvz' ? `PVZ:${selectedPvz?.code ?? ''}` : 'DOOR',
      deliveryPrice,
      deliveryEta,
      address,
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      cdekExtras: {
        cdekTariffCode:
          deliveryType === 'pvz' ? calc?.pvz?.tariffCode : calc?.door?.tariffCode,
        cdekCityCode: selectedCity.code,
        cdekCityName: selectedCity.full_name,
        cdekPvzCode: deliveryType === 'pvz' ? (selectedPvz?.code ?? null) : null,
        cdekPvzAddress: deliveryType === 'pvz' ? (selectedPvz?.address ?? null) : null,
      },
    })
  }, [
    selectedCity,
    deliveryType,
    selectedPvz,
    houseAddress,
    calc,
    updateCheckout,
    recipientName,
    recipientPhone,
  ])

  const selectStreetSuggestion = useCallback((suggestion: AddressSuggestion) => {
    setSelectedStreetValue(suggestion.value)
    setStreetQuery(suggestion.value)
    setStreetSuggestions([])
    setStreetLookupState('idle')
    if (suggestion.flat) {
      setFlat(suggestion.flat)
    }
  }, [])

  const handlePay = useCallback(async () => {
    if (isSubmitting || !checkoutReady || !userId) return
    setIsSubmitting(true)
    setPaymentError(null)
    try {
      const snapshot = buildPaymentSnapshot(userId)
      const { paymentId, confirmationUrl } = await createPayment(snapshot)
      sessionStorage.setItem('muru-pending-payment', paymentId)
      const webApp = window.Telegram?.WebApp
      if (webApp?.openLink) {
        webApp.openLink(confirmationUrl)
      } else {
        window.location.href = confirmationUrl
      }
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : 'Не удалось создать платёж')
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, checkoutReady, userId, buildPaymentSnapshot])

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return

    webApp.MainButton.setText('Перейти к оплате')
    if (checkoutReady && !isLoading && !isSubmitting) {
      webApp.MainButton.enable()
    } else {
      webApp.MainButton.disable()
    }
    webApp.MainButton.show()
    webApp.MainButton.onClick(handlePay)

    return () => {
      webApp.MainButton.offClick(handlePay)
      webApp.MainButton.hide()
    }
  }, [handlePay, checkoutReady, isLoading, isSubmitting])

  const selectCity = (city: CdekCity) => {
    setSelectedCity(city)
    setCityQuery(city.full_name)
    setCitySuggestions([])
    setCityLookupState('idle')
    setSelectedPvz(null)
    setCalc(null)
  }

  return (
    <section className="space-y-3 pb-3">
      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h1 className="text-xl font-semibold text-muru-olive">Оформление заказа</h1>
        <p className="mt-2 text-sm">Заполните данные доставки и перейдите к онлайн-оплате.</p>
      </div>

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h2 className="text-sm font-semibold text-muru-olive">Получатель</h2>
        <input
          value={recipientName}
          onChange={(event) => setRecipientName(event.target.value)}
          placeholder="ФИО полностью"
          className="mt-2 w-full rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm"
        />
        <input
          value={recipientPhone}
          onChange={(event) => setRecipientPhone(event.target.value)}
          placeholder="+7 (___) ___-__-__"
          inputMode="tel"
          className="mt-2 w-full rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm"
        />
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
        {cityLookupState === 'loading' ? (
          <p className="mt-2 text-xs text-[#6b6b4a]">Ищем город…</p>
        ) : null}
        {cityLookupState === 'empty' ? (
          <p className="mt-2 text-xs text-[#6b6b4a]">Город не найден. Проверьте написание.</p>
        ) : null}
        {cityLookupState === 'error' ? (
          <p className="mt-2 text-xs text-red-700">
            Не удалось загрузить города. Проверьте сеть и попробуйте снова.
          </p>
        ) : null}
        {cityLookupState === 'idle' && citySuggestions.length > 0 ? (
          <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto">
            {citySuggestions.map((city) => (
              <button
                key={`${city.code}-${city.full_name}`}
                type="button"
                className={`${pressable} rounded-lg bg-[#efe8d8] px-2 py-1 text-left text-xs text-muru-text`}
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
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-xs font-medium text-muru-olive" htmlFor="house-address">
                  Улица и дом
                </label>
                <input
                  id="house-address"
                  value={streetQuery}
                  onChange={(event) => {
                    setStreetQuery(event.target.value)
                    if (selectedStreetValue && event.target.value !== selectedStreetValue) {
                      setSelectedStreetValue('')
                    }
                  }}
                  placeholder="Например: Невский пр., 1"
                  className="mt-1 w-full rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm"
                />
                {streetLookupState === 'loading' ? (
                  <p className="mt-1 text-xs text-[#6b6b4a]">Ищем адрес…</p>
                ) : null}
                {streetLookupState === 'disabled' ? (
                  <p className="mt-1 text-xs text-[#6b6b4a]">
                    Подсказки недоступны — введите улицу и дом вручную.
                  </p>
                ) : null}
                {streetLookupState === 'empty' ? (
                  <p className="mt-1 text-xs text-[#6b6b4a]">Адрес не найден. Проверьте написание.</p>
                ) : null}
                {streetLookupState === 'error' ? (
                  <p className="mt-1 text-xs text-red-700">
                    Не удалось загрузить адрес. Попробуйте ещё раз.
                  </p>
                ) : null}
                {streetLookupState === 'idle' && streetSuggestions.length > 0 ? (
                  <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto">
                    {streetSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.value}
                        type="button"
                        className={`${pressable} rounded-lg bg-[#efe8d8] px-2 py-1 text-left text-xs text-muru-text`}
                        onClick={() => selectStreetSuggestion(suggestion)}
                      >
                        {suggestion.value}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div>
                <label className="text-xs font-medium text-muru-olive" htmlFor="flat-number">
                  Квартира / офис (если есть)
                </label>
                <input
                  id="flat-number"
                  value={flat}
                  onChange={(event) => setFlat(event.target.value)}
                  placeholder="Например: 10"
                  className="mt-1 w-full rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm"
                />
              </div>
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
            <div className="mt-2 space-y-1">
              <p className="text-xs text-red-700">{calc.errors.join('; ')}</p>
              {!calc.door && !calc.pvz ? (
                <p className="text-xs text-[#6b6b4a]">
                  Доставка временно недоступна для этого города. Напишите менеджеру или попробуйте
                  другой город.
                </p>
              ) : null}
            </div>
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
              {activatedPromo.code}: −{formatPrice(activatedPromo.discount)}
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
        <p className="tabular-nums">Товары: {formatPrice(subtotal)}</p>
        <p className="tabular-nums">Скидка: - {formatPrice(discount)}</p>
        <p className="tabular-nums">Доставка: {formatPrice(checkout.deliveryPrice)}</p>
        {checkout.deliveryEta ? <p className="text-xs text-[#6b6b4a]">Срок: {checkout.deliveryEta}</p> : null}
        <p className="mt-1 font-semibold tabular-nums">Итого: {formatPrice(total)}</p>
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
              ? `${formatPrice(calc.door.deliverySum)}, ${formatEta(calc.door)}`
              : 'недоступно'}
          </p>
          <p
            className={
              deliveryType === 'pvz' ? 'mt-1 font-semibold text-muru-olive' : 'mt-1 text-[#6b6b4a]'
            }
          >
            До ПВЗ:{' '}
            {calc.pvz
              ? `${formatPrice(calc.pvz.deliverySum)}, ${formatEta(calc.pvz)}`
              : 'недоступно'}
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {paymentError ? <p className="text-sm text-[#9a5b43]">{paymentError}</p> : null}
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
        <label className="mt-4 flex items-start gap-2 text-xs leading-snug text-muru-text">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-muru-olive"
          />
          <span>
            Я соглашаюсь с{' '}
            <button
              type="button"
              className="text-muru-olive underline"
              onClick={() => onOpenLegal('terms')}
            >
              Пользовательским соглашением
            </button>{' '}
            и{' '}
            <button
              type="button"
              className="text-muru-olive underline"
              onClick={() => onOpenLegal('privacy')}
            >
              Политикой обработки персональных данных
            </button>
            .
          </span>
        </label>
        <button
          type="button"
          className={`${pressableDisabled} rounded-xl bg-muru-olive px-4 py-3 text-sm font-semibold text-muru-ivory`}
          disabled={isLoading || isSubmitting || !checkoutReady}
          onClick={handlePay}
        >
          Перейти к оплате
        </button>
      </div>
    </section>
  )
}
