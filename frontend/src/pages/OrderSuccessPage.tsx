import { useEffect, useRef, useState } from 'react'

import { ReceiptGlyph } from '../components/Glyphs'
import {
  fetchPaymentIntentStatus,
  fetchPaymentStatus,
  type OrderSuccessSummary,
} from '../lib/api'
import { formatPrice } from '../lib/format'
import { hapticNotification } from '../lib/haptics'
import { pressable, cardSurface } from '../lib/uiClasses'

type OrderSuccessPageProps = {
  summary: OrderSuccessSummary
  onGoCatalog: () => void
  onGoProfile: () => void
}

const MAX_POLL_ATTEMPTS = 15
const POLL_INTERVAL_MS = 2000

export const OrderSuccessPage = ({ summary, onGoCatalog, onGoProfile }: OrderSuccessPageProps) => {
  const [orderId, setOrderId] = useState<number | null>(summary.orderId ?? null)
  const attemptsRef = useRef(0)

  useEffect(() => {
    hapticNotification('success')
    const webApp = window.Telegram?.WebApp
    webApp?.MainButton.hide()
    return () => {
      webApp?.MainButton.hide()
    }
  }, [])

  useEffect(() => {
    if (orderId) return
    if (!summary.intentId && !summary.paymentId) return

    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      if (stopped) return
      attemptsRef.current += 1
      try {
        const res = summary.intentId
          ? await fetchPaymentIntentStatus(summary.intentId)
          : await fetchPaymentStatus(summary.paymentId!)
        if (res.orderId) {
          setOrderId(res.orderId)
          return
        }
      } catch {
        /* keep polling */
      }
      if (attemptsRef.current >= MAX_POLL_ATTEMPTS) return
      timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [summary.intentId, summary.paymentId, orderId])

  const hasItems = summary.items.length > 0

  return (
    <section className="space-y-4 pb-6">
      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-6 text-center">
        <ReceiptGlyph className="mx-auto h-14 w-14 text-muru-olive" />
        <h1 className="mt-4 font-muru-display text-[1.6rem] font-medium text-muru-olive">
          Спасибо за покупку!
        </h1>
        <p className="mt-2 text-sm text-[#6f6655]">Оплата прошла успешно</p>
      </div>

      <div className={`${cardSurface} border border-muru-accent bg-[#fff9ed] p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muru-olive">
            {orderId ? `Заказ №${orderId}` : 'Формируем заказ…'}
          </h2>
          {!orderId ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muru-accent border-t-muru-olive" />
          ) : null}
        </div>

        {hasItems ? (
          <>
            <ul className="mt-3 space-y-2">
              {summary.items.map((item) => (
                <li
                  key={`${item.name}-${item.quantity}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 text-muru-text">
                    {item.name}
                    <span className="text-xs text-[#8a7f6d]"> × {item.quantity}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatPrice(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-muru-accent/40 pt-3 text-sm">
              <p className="flex justify-between tabular-nums">
                <span>Товары</span>
                <span>{formatPrice(summary.subtotal)}</span>
              </p>
              {summary.discount > 0 ? (
                <p className="flex justify-between tabular-nums text-[#8f2b2b]">
                  <span>Скидка</span>
                  <span>− {formatPrice(summary.discount)}</span>
                </p>
              ) : null}
              {summary.deliveryPrice > 0 ? (
                <p className="flex justify-between tabular-nums">
                  <span>Доставка</span>
                  <span>{formatPrice(summary.deliveryPrice)}</span>
                </p>
              ) : null}
              <p className="flex justify-between font-semibold tabular-nums text-muru-olive">
                <span>Итого</span>
                <span>{formatPrice(summary.total)}</span>
              </p>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-[#6f6655]">
            Заказ принят в работу. Подробности — в личном кабинете.
          </p>
        )}

        {summary.address ? (
          <p className="mt-3 text-xs text-[#8a7f6d]">
            Доставка: {summary.address}
            {summary.deliveryEta ? ` · ${summary.deliveryEta}` : ''}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          className={`${pressable} rounded-xl bg-muru-olive px-4 py-3 text-sm font-semibold text-muru-ivory`}
          onClick={onGoCatalog}
        >
          В каталог
        </button>
        <button
          type="button"
          className={`${pressable} rounded-xl bg-[#efe8d8] px-4 py-3 text-sm font-medium text-muru-text`}
          onClick={onGoProfile}
        >
          Личный кабинет
        </button>
      </div>
    </section>
  )
}
