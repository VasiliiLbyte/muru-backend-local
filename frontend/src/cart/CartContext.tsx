import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { createOrder, fetchOrderDraft, saveOrderDraft, validateOrderPromo } from '../lib/api'
import type { CartItem, CheckoutForm, DraftOrder } from '../types/cart'
import type { CatalogProduct, CatalogProductDetail } from '../types/catalog'
import type { PromoDiscountType } from '../lib/api'

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
  submitOrder: (telegramUserId?: number) => Promise<DraftOrder>
}

const defaultCheckout: CheckoutForm = {
  deliveryMode: 'delivery',
  deliveryOption: 'Курьер CDEK',
  deliveryPrice: 390,
  deliveryEta: '2-4 дня',
  address: '',
  comment: '',
  birthDate: '',
}

const CartContext = createContext<CartContextValue | null>(null)

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([])
  const [checkout, setCheckout] = useState<CheckoutForm>(defaultCheckout)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promoInput, setPromoInput] = useState('')
  const [activatedPromo, setActivatedPromo] = useState<ActivatedPromo | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items])
  const discount = activatedPromo?.discount ?? 0
  const isPromoActive = activatedPromo != null
  const promoCode = activatedPromo?.code ?? ''
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

  const loadDraft = useCallback(async (telegramUserId?: number) => {
    if (!telegramUserId) return
    setIsLoading(true)
    setError(null)
    try {
      const draft = await fetchOrderDraft(telegramUserId)
      if (!draft) return
      setItems(draft.items)
      clearPromoState()
      setPromoInput('')
      setCheckout({
        deliveryMode: draft.deliveryMode,
        deliveryOption: draft.deliveryOption ?? '',
        deliveryPrice: draft.deliveryPrice,
        deliveryEta: draft.deliveryEta ?? '',
        address: draft.address,
        comment: draft.comment,
        birthDate: draft.birthDate ?? '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить корзину')
    } finally {
      setIsLoading(false)
    }
  }, [clearPromoState])

  const addProduct = useCallback((product: CatalogProduct | CatalogProductDetail) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.sku === product.sku)
      if (existing) {
        return prev.map((item) => (item.sku === product.sku ? { ...item, quantity: item.quantity + 1 } : item))
      }
      return [
        ...prev,
        {
          sku: product.sku,
          name: product.name,
          price: product.price,
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
    async (telegramUserId?: number) => {
      if (!telegramUserId) return
      setIsLoading(true)
      setError(null)
      try {
        const draft = await saveOrderDraft({
          telegramUserId,
          items,
          deliveryMode: checkout.deliveryMode,
          deliveryOption: checkout.deliveryOption,
          deliveryPrice: checkout.deliveryMode === 'pickup' ? 0 : checkout.deliveryPrice,
          deliveryEta: checkout.deliveryMode === 'pickup' ? 'Самовывоз сегодня' : checkout.deliveryEta,
          address: checkout.address,
          comment: checkout.comment,
          birthDate: checkout.birthDate || undefined,
        })
        setItems(draft.items)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось сохранить черновик')
      } finally {
        setIsLoading(false)
      }
    },
    [items, checkout],
  )

  const submitOrder = useCallback(
    async (telegramUserId?: number) => {
      if (!telegramUserId) throw new Error('Не удалось определить Telegram user ID')
      setIsLoading(true)
      setError(null)
      try {
        const createdOrder = await createOrder({
          telegramUserId,
          items,
          deliveryMode: checkout.deliveryMode,
          deliveryOption: checkout.deliveryOption,
          deliveryPrice: checkout.deliveryMode === 'pickup' ? 0 : checkout.deliveryPrice,
          deliveryEta: checkout.deliveryMode === 'pickup' ? 'Самовывоз сегодня' : checkout.deliveryEta,
          address: checkout.address,
          comment: checkout.comment,
          birthDate: checkout.birthDate || undefined,
          promoCode: activatedPromo?.code,
        })
        setItems([])
        setCheckout(defaultCheckout)
        clearPromo()
        return createdOrder
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось создать заказ'
        setError(message)
        throw new Error(message, { cause: err })
      } finally {
        setIsLoading(false)
      }
    },
    [items, checkout, activatedPromo, clearPromo],
  )

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
      submitOrder,
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
      total,
      loadDraft,
      addProduct,
      updateQuantity,
      removeItem,
      applyPromo,
      clearPromo,
      updateCheckout,
      persistDraft,
      submitOrder,
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
