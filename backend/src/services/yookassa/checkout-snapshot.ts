import type { TrustedPricing } from './pricing.service'
import type { CheckoutSnapshot, RawCheckoutInput } from './payments.service'

export const buildSnapshotFromPricing = (
  raw: RawCheckoutInput,
  pricing: TrustedPricing,
): CheckoutSnapshot => ({
  telegramUserId: raw.telegramUserId,
  items: pricing.items,
  subtotal: pricing.subtotal,
  deliveryPrice: pricing.deliveryPrice,
  promoCode: pricing.promoCode,
  promoDiscount: pricing.promoDiscount,
  total: pricing.total,
  deliveryMode: raw.deliveryMode,
  deliveryOption: raw.deliveryOption,
  deliveryEta: raw.deliveryEta,
  address: raw.address,
  comment: raw.comment,
  birthDate: raw.birthDate,
  recipientName: raw.recipientName,
  recipientPhone: raw.recipientPhone,
  cdekTariffCode: raw.cdekTariffCode,
  cdekCityCode: raw.cdekCityCode,
  cdekCityName: raw.cdekCityName,
  cdekPvzCode: raw.cdekPvzCode,
  cdekPvzAddress: raw.cdekPvzAddress,
})
