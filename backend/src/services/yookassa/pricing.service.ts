import { calculateTariff } from '../cdek/calc.service'
import { buildPackagesFromCart } from '../cdek/packaging.service'
import { PromoValidationError, validatePromoCode } from '../promo.service'
import { pool } from '../../utils/db'
import { env } from '../../utils/env'

export class PaymentPricingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaymentPricingError'
  }
}

export type TrustedLine = {
  sku: string
  name: string
  price: number
  originalPrice?: number
  quantity: number
  color?: string
  size?: string
}

export type TrustedPricing = {
  items: TrustedLine[]
  subtotal: number
  deliveryPrice: number
  promoCode: string | null
  promoDiscount: number
  total: number
}

export type PricingInput = {
  telegramUserId: number
  items: Array<{ sku: string; quantity: number; color?: string; size?: string }>
  deliveryMode: 'delivery' | 'pickup'
  promoCode: string | null
  cdekTariffCode: number | null
  cdekCityCode: number | null
}

const round2 = (n: number) => Math.max(0, Number(n.toFixed(2)))

const allowedTariffCodes = () => new Set([env.cdek.tariffDoor, env.cdek.tariffPvz])

export const computeTrustedPricing = async (input: PricingInput): Promise<TrustedPricing> => {
  if (input.items.length === 0) {
    throw new PaymentPricingError('Корзина пуста')
  }

  const skus = input.items.map((i) => i.sku)
  const rows = await pool.query<{
    sku: string
    name: string
    price: string
    discount_percent: string
    in_stock: number
  }>(
    `SELECT sku, name, price::text, discount_percent::text, in_stock FROM products WHERE sku = ANY($1::text[])`,
    [skus],
  )
  const dbMap = new Map(rows.rows.map((r) => [r.sku, r]))

  const items: TrustedLine[] = []
  for (const line of input.items) {
    const db = dbMap.get(line.sku)
    if (!db) {
      throw new PaymentPricingError(`Товар не найден: ${line.sku}`)
    }
    if (line.quantity < 1) {
      throw new PaymentPricingError(`Некорректное количество для ${line.sku}`)
    }
    const basePrice = Number(db.price)
    const discountPct = Number(db.discount_percent) || 0
    const effectivePrice =
      discountPct > 0
        ? Math.round(basePrice * (1 - discountPct / 100) * 100) / 100
        : basePrice
    items.push({
      sku: db.sku,
      name: db.name,
      price: effectivePrice,
      ...(discountPct > 0 ? { originalPrice: basePrice } : {}),
      quantity: line.quantity,
      color: line.color,
      size: line.size,
    })
  }

  const subtotal = round2(items.reduce((s, i) => s + i.price * i.quantity, 0))

  let deliveryPrice = 0
  if (input.deliveryMode === 'delivery') {
    if (!input.cdekTariffCode || !input.cdekCityCode) {
      throw new PaymentPricingError('Для доставки нужны тариф и город СДЭК')
    }
    const tariffs = allowedTariffCodes()
    if (!tariffs.has(input.cdekTariffCode)) {
      throw new PaymentPricingError('Недопустимый тариф доставки')
    }
    const packages = await buildPackagesFromCart(
      items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
    )
    const calc = await calculateTariff({
      tariffCode: input.cdekTariffCode,
      toCityCode: input.cdekCityCode,
      packages,
    })
    deliveryPrice = round2(calc.deliverySum)
    if (deliveryPrice <= 0) {
      throw new PaymentPricingError('СДЭК вернул нулевую стоимость доставки')
    }
  }

  let promoDiscount = 0
  let promoCode: string | null = null
  if (input.promoCode?.trim()) {
    const validation = await validatePromoCode({
      code: input.promoCode,
      telegramUserId: input.telegramUserId,
      subtotal,
    })
    if (!validation.valid) {
      throw new PromoValidationError(validation.reason)
    }
    promoDiscount = round2(validation.discountValue)
    promoCode = validation.code
  }

  const total = round2(Math.max(0, subtotal - promoDiscount) + deliveryPrice)
  return { items, subtotal, deliveryPrice, promoCode, promoDiscount, total }
}
