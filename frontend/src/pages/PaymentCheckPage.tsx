import { useEffect, useRef, useState } from 'react'

import { ReceiptGlyph } from '../components/Glyphs'
import { fetchPaymentStatus } from '../lib/api'

type PaidResult = {
  paymentId: string
  orderId: number | null
}

type Props = {
  paymentId: string
  onPaid: (result: PaidResult) => void
  onCanceled: () => void
}

export const PaymentCheckPage = ({ paymentId, onPaid, onCanceled }: Props) => {
  const [status, setStatus] = useState<'checking' | 'canceled' | 'timeout'>('checking')
  const attemptsRef = useRef(0)
  const onPaidRef = useRef(onPaid)
  const onCanceledRef = useRef(onCanceled)

  onPaidRef.current = onPaid
  onCanceledRef.current = onCanceled

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      if (stopped) return
      attemptsRef.current += 1
      try {
        const res = await fetchPaymentStatus(paymentId)
        if (res.status === 'succeeded') {
          onPaidRef.current({ paymentId, orderId: res.orderId })
          return
        }
        if (res.status === 'canceled') {
          setStatus('canceled')
          onCanceledRef.current()
          return
        }
      } catch {
        /* keep polling */
      }
      if (attemptsRef.current >= 40) {
        setStatus('timeout')
        return
      }
      timer = setTimeout(poll, 3000)
    }

    void poll()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [paymentId])

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      {status === 'checking' ? (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muru-accent border-t-muru-olive" />
          <p className="text-sm text-muru-olive">Проверяем оплату…</p>
          <p className="text-xs text-[#7a7165]">Это занимает несколько секунд. Не закрывайте приложение.</p>
        </>
      ) : null}
      {status === 'timeout' ? (
        <>
          <ReceiptGlyph className="mx-auto h-12 w-12 text-muru-olive" />
          <p className="text-sm text-muru-olive">Платёж ещё обрабатывается</p>
          <p className="text-xs text-[#7a7165]">
            Проверьте «Мои заказы» в профиле через пару минут.
          </p>
        </>
      ) : null}
      {status === 'canceled' ? (
        <>
          <p className="text-sm font-medium text-muru-olive">Платёж не завершён</p>
          <p className="text-xs text-[#7a7165]">Попробуйте оформить заказ снова из корзины.</p>
        </>
      ) : null}
    </section>
  )
}
