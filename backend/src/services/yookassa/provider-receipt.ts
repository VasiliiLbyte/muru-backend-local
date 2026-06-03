import { buildReceipt } from './receipt'

export const buildProviderData = (params: {
  phone: string
  productItems: { description: string; priceKop: number; quantity: number }[]
  deliveryKop: number
  discountKop: number
}): string => {
  const receipt = buildReceipt(params)
  return JSON.stringify({ receipt })
}
