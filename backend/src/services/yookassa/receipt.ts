import { env } from '../../utils/env'

type ReceiptItemInput = { description: string; priceKop: number; quantity: number }

/**
 * Builds receipt line items. Amounts in kopecks internally; API strings use "0.00" rubles.
 * Discount is spread proportionally across product lines; remainder on the last line.
 */
export const buildReceipt = (params: {
  phone: string
  productItems: ReceiptItemInput[]
  deliveryKop: number
  discountKop: number
}) => {
  const vat = env.yookassa.vatCode

  const rawLines = params.productItems.map((it) => ({
    description: it.description.slice(0, 128),
    quantity: it.quantity,
    sumKop: it.priceKop * it.quantity,
    payment_subject: 'commodity' as const,
  }))

  const productsTotal = rawLines.reduce((s, l) => s + l.sumKop, 0)
  let distributed = 0
  const discountedLines = rawLines.map((l, idx) => {
    let lineDiscount: number
    if (idx === rawLines.length - 1) {
      lineDiscount = params.discountKop - distributed
    } else {
      lineDiscount = productsTotal > 0 ? Math.round((params.discountKop * l.sumKop) / productsTotal) : 0
      distributed += lineDiscount
    }
    return { ...l, sumKop: Math.max(0, l.sumKop - lineDiscount) }
  })

  type ReceiptLine = {
    description: string
    quantity: string
    amount: { value: string; currency: string }
    vat_code: number
    payment_mode: string
    payment_subject: 'commodity' | 'service'
  }

  const items: ReceiptLine[] = discountedLines.map((l) => ({
    description: l.description,
    quantity: l.quantity.toFixed(2),
    amount: { value: kopToStr(l.sumKop), currency: 'RUB' },
    vat_code: vat,
    payment_mode: 'full_payment',
    payment_subject: l.payment_subject,
  }))

  if (params.deliveryKop > 0) {
    items.push({
      description: 'Доставка СДЭК',
      quantity: '1.00',
      amount: { value: kopToStr(params.deliveryKop), currency: 'RUB' },
      vat_code: vat,
      payment_mode: 'full_payment',
      payment_subject: 'service',
    })
  }

  return {
    customer: { phone: normalizePhoneForReceipt(params.phone) },
    items,
  }
}

export const receiptTotalKop = (params: {
  productItems: { priceKop: number; quantity: number }[]
  deliveryKop: number
  discountKop: number
}): number => {
  const products = params.productItems.reduce((s, it) => s + it.priceKop * it.quantity, 0)
  return Math.max(0, products - params.discountKop) + params.deliveryKop
}

const kopToStr = (kop: number): string => (kop / 100).toFixed(2)

export const normalizePhoneForReceipt = (raw: string): string => {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1)
  if (digits.length === 11 && digits.startsWith('7')) return '+' + digits
  if (digits.length === 10) return '+7' + digits
  return '+' + digits
}
