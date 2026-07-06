import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  fetchOrderDraft,
  saveOrderDraft,
  validateOrderPromo,
  type PaymentCheckoutPayload,
} from '../lib/api'
import type { CartItem, CheckoutForm, DraftOrder } from '../types/cart'
import { hapticImpact } from '../lib/haptics'
import type { CatalogProduct, CatalogProductDetail } from '../types/catalog'
import type { PromoDiscountType } from '../lib/api'

import { clearCartSnapshot, readCartSnapshot, writeCartSnapshot } from './cartStorage'

export type ActivatedPromo = {
  code: string
  discount: number
  discountType: PromoDiscountType
}

type CartContextValue = {
  items: CartItem[]
  checkout: CheckoutForm
  isLoading: boolean
  error: string | null
  promoInput: string
  activatedPromo: ActivatedPromo | null
  promoError: string | null
  isPromoActive: boolean
  promoCode: string
  discount: number
  subtotal: number
  cartTotal: number
  total: number
  loadDraft: (telegramUserId?: number) => Promise<void>
  addProduct: (product: CatalogProduct | CatalogProductDetail) => void
  updateQuantity: (sku: string, quantity: number) => void
  removeItem: (sku: string) => void
  setPromoInput: (value: string) => void
  applyPromo: () => Promise<void>
  clearPromo: () => void
  updateCheckout: (patch: Partial<CheckoutForm>) => void
  persistDraft: (telegramUserId?: number) => Promise<void>
  buildPaymentSnapshot: (telegramUserId: number) => PaymentCheckoutPayload
  clearCartAfterPayment: () => void
}

const defaultCheckout: CheckoutForm = {
  deliveryMode: 'delivery',
  deliveryOption: 'DOOR',
  deliveryPrice: 0,
  deliveryEta: '',
  address: '',
  comment: '',
  birthDate: '',
  cdekExtras: undefined,
}

const AUTOSAVE_MS = 2000

const checkoutFromDraft = (draft: DraftOrder): CheckoutForm => ({
  deliveryMode: draft.deliveryMode,
  deliveryOption: draft.deliveryOption ?? '',
  deliveryPrice: draft.deliveryPrice,
  deliveryEta: draft.deliveryEta ?? '',
  address: draft.address,
  comment: draft.comment,
  birthDate: draft.birthDate ?? '',
  recipientName: draft.recipientName ?? '',
  recipientPhone: draft.recipientPhone ?? '',
  cdekExtras:
    draft.cdekCityCode != null
      ? {
          cdekTariffCode: draft.cdekTariffCode ?? undefined,
          cdekCityCode: draft.cdekCityCode,
          cdekCityName: draft.cdekCityName ?? undefined,
          cdekPvzCode: draft.cdekPvzCode ?? null,
          cdekPvzAddress: draft.cdekPvzAddress ?? null,
        }
      : undefined,
})

const CartContext = createContext<CartContextValue | null>(null)

type CartProviderProps = {
  children: ReactNode
  telegramUserId?: number
}

export const CartProvider = ({ children, telegramUserId }: CartProviderProps) => {
  const [items, setItems] = useState<CartItem[]>([])
  const [checkout, setCheckout] = useState<CheckoutForm>(defaultCheckout)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promoInput, setPromoInput] = useState('')
  const [activatedPromo, setActivatedPromo] = useState<ActivatedPromo | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)

  const hydratedUserIdRef = useRef<number | null>(null)
  const skipAutosaveRef = useRef(false)

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items])
  const discount = activatedPromo?.discount ?? 0
  const isPromoActive = activatedPromo != null
  const promoCode = activatedPromo?.code ?? ''
  const cartTotal = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount])
  const total = useMemo(
    () => Math.max(0, subtotal - discount + (checkout.deliveryMode === 'pickup' ? 0 : checkout.deliveryPrice)),
    [subtotal, discount, checkout.deliveryMode, checkout.deliveryPrice],
  )

  const clearPromoState = useCallback(() => {
    setActivatedPromo(null)
    setPromoError(null)
  }, [])

  useEffect(() => {
    if (items.length === 0) {
      clearPromoState()
      setPromoInput('')
    }
  }, [items.length, clearPromoState])

  const buildDraftPayload = useCallback(
    (userId: number) => ({
      telegramUserId: userId,
      items,
      deliveryMode: checkout.deliveryMode,
      deliveryOption: checkout.deliveryOption,
      deliveryPrice: checkout.deliveryMode === 'pickup' ? 0 : checkout.deliveryPrice,
      deliveryEta: checkout.deliveryMode === 'pickup' ? 'Самовывоз сегодня' : checkout.deliveryEta,
      address: checkout.address,
      comment: checkout.comment,
      birthDate: checkout.birthDate || undefined,
      cdekTariffCode: checkout.cdekExtras?.cdekTariffCode,
      cdekCityCode: checkout.cdekExtras?.cdekCityCode,
      cdekCityName: checkout.cdekExtras?.cdekCityName,
      cdekPvzCode: checkout.cdekExtras?.cdekPvzCode ?? null,
      cdekPvzAddress: checkout.cdekExtras?.cdekPvzAddress ?? null,
      recipientName: checkout.recipientName,
      recipientPhone: checkout.recipientPhone,
    }),
    [items, checkout],
  )

  const loadDraft = useCallback(
    async (userId?: number) => {
      const id = userId ?? telegramUserId
      if (!id) return
      setIsLoading(true)
      setError(null)
      try {
        const draft = await fetchOrderDraft(id)
        if (!draft) return
        const nextCheckout = checkoutFromDraft(draft)
        setItems((prev) => (prev.length === 0 ? draft.items : prev))
        clearPromoState()
        setPromoInput('')
        setCheckout(nextCheckout)
        writeCartSnapshot(id, { items: draft.items, checkout: nextCheckout })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить корзину')
      } finally {
        setIsLoading(false)
      }
    },
    [telegramUserId, clearPromoState],
  )

  useEffect(() => {
    if (!telegramUserId) return
    if (hydratedUserIdRef.current === telegramUserId) return

    hydratedUserIdRef.current = telegramUserId
    skipAutosaveRef.current = true

    const local = readCartSnapshot(telegramUserId)
    if (local && local.items.length > 0) {
      setItems(local.items)
      setCheckout(local.checkout)
      skipAutosaveRef.current = false
      return
    }

    void loadDraft(telegramUserId).finally(() => {
      skipAutosaveRef.current = false
    })
  }, [telegramUserId, loadDraft])

  useEffect(() => {
    if (!telegramUserId || skipAutosaveRef.current) return

    if (items.length === 0) {
      clearCartSnapshot(telegramUserId)
    } else {
      writeCartSnapshot(telegramUserId, { items, checkout })
    }

    const timer = window.setTimeout(() => {
      void saveOrderDraft(buildDraftPayload(telegramUserId)).catch((err) => {
        console.warn('[cart-autosave] draft save failed', err)
      })
    }, AUTOSAVE_MS)

    return () => window.clearTimeout(timer)
  }, [telegramUserId, items, checkout, buildDraftPayload])

  const addProduct = useCallback((product: CatalogProduct | CatalogProductDetail) => {
    hapticImpact('light')
    setItems((prev) => {
      const existing = prev.find((item) => item.sku === product.sku)
      if (existing) {
        return prev.map((item) => (item.sku === product.sku ? { ...item, quantity: item.quantity + 1 } : item))
      }
      const pct = product.discountPercent ?? 0
      const effectivePrice =
        pct > 0 ? Math.round(product.price * (1 - pct / 100) * 100) / 100 : product.price
      return [
        ...prev,
        {
          sku: product.sku,
          name: product.name,
          price: effectivePrice,
          ...(pct > 0 ? { originalPrice: product.price } : {}),
          quantity: 1,
          imageUrl: product.imageUrls[0],
        },
      ]
    })
  }, [])

  const updateQuantity = useCallback((sku: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((item) => (item.sku === sku ? { ...item, quantity: Math.max(1, quantity) } : item))
        .filter((item) => item.quantity > 0),
    )
  }, [])

  const removeItem = useCallback((sku: string) => {
    setItems((prev) => prev.filter((item) => item.sku !== sku))
  }, [])

  const updateCheckout = useCallback((patch: Partial<CheckoutForm>) => {
    setCheckout((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearPromo = useCallback(() => {
    clearPromoState()
    setPromoInput('')
  }, [clearPromoState])

  const applyPromo = useCallback(async () => {
    const code = promoInput.trim()
    if (!code) {
      setPromoError('Введите промокод')
      return
    }
    if (subtotal <= 0) {
      setPromoError('Добавьте товары в корзину')
      return
    }

    setPromoError(null)
    setIsLoading(true)
    try {
      const result = await validateOrderPromo({ code, subtotal })
      if (!result.valid) {
        setActivatedPromo(null)
        setPromoError(result.reason)
        return
      }
      setActivatedPromo({
        code: result.code,
        discount: result.discountValue,
        discountType: result.discountType,
      })
      setPromoInput(result.code)
    } catch (err) {
      setActivatedPromo(null)
      setPromoError(err instanceof Error ? err.message : 'Не удалось применить промокод')
    } finally {
      setIsLoading(false)
    }
  }, [promoInput, subtotal])

  const persistDraft = useCallback(
    async (userId?: number) => {
      const id = userId ?? telegramUserId
      if (!id) return
      setIsLoading(true)
      setError(null)
      try {
        const draft = await saveOrderDraft(buildDraftPayload(id))
        setItems(draft.items)
        setCheckout(checkoutFromDraft(draft))
        writeCartSnapshot(id, { items: draft.items, checkout: checkoutFromDraft(draft) })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось сохранить черновик')
      } finally {
        setIsLoading(false)
      }
    },
    [telegramUserId, buildDraftPayload],
  )

  const buildPaymentSnapshot = useCallback(
    (_userId: number): PaymentCheckoutPayload => ({
      items: items.map((i) => ({
        sku: i.sku,
        quantity: i.quantity,
        color: i.color,
        size: i.size,
      })),
      promoCode: activatedPromo?.code ?? null,
      deliveryMode: checkout.deliveryMode,
      deliveryOption: checkout.deliveryOption ?? null,
      deliveryEta: checkout.deliveryMode === 'pickup' ? 'Самовывоз сегодня' : checkout.deliveryEta || null,
      address: checkout.address,
      comment: checkout.comment,
      birthDate: checkout.birthDate || null,
      recipientName: checkout.recipientName ?? '',
      recipientPhone: checkout.recipientPhone ?? '',
      cdekTariffCode: checkout.cdekExtras?.cdekTariffCode ?? null,
      cdekCityCode: checkout.cdekExtras?.cdekCityCode ?? null,
      cdekCityName: checkout.cdekExtras?.cdekCityName ?? null,
      cdekPvzCode: checkout.cdekExtras?.cdekPvzCode ?? null,
      cdekPvzAddress: checkout.cdekExtras?.cdekPvzAddress ?? null,
    }),
    [items, checkout, activatedPromo],
  )

  const clearCartAfterPayment = useCallback(() => {
    const id = telegramUserId
    setItems([])
    setCheckout(defaultCheckout)
    if (id) clearCartSnapshot(id)
    clearPromo()
  }, [telegramUserId, clearPromo])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      checkout,
      isLoading,
      error,
      promoInput,
      activatedPromo,
      promoError,
      isPromoActive,
      promoCode,
      discount,
      subtotal,
      cartTotal,
      total,
      loadDraft,
      addProduct,
      updateQuantity,
      removeItem,
      setPromoInput,
      applyPromo,
      clearPromo,
      updateCheckout,
      persistDraft,
      buildPaymentSnapshot,
      clearCartAfterPayment,
    }),
    [
      items,
      checkout,
      isLoading,
      error,
      promoInput,
      activatedPromo,
      promoError,
      isPromoActive,
      promoCode,
      discount,
      subtotal,
      cartTotal,
      total,
      loadDraft,
      addProduct,
      updateQuantity,
      removeItem,
      applyPromo,
      clearPromo,
      updateCheckout,
      persistDraft,
      buildPaymentSnapshot,
      clearCartAfterPayment,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
