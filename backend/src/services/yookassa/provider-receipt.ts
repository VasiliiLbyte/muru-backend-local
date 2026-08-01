import { buildReceipt } from './receipt'
import { getEffectiveConfig } from '../runtime-config.service'

export const buildProviderData = async (params: {
  phone: string
  productItems: { description: string; priceKop: number; quantity: number }[]
  deliveryKop: number
  discountKop: number
}): Promise<string> => {
  const cfg = await getEffectiveConfig()
  const receipt = buildReceipt({ ...params, vatCode: cfg.yookassa.vatCode })
  return JSON.stringify({ receipt })
}
