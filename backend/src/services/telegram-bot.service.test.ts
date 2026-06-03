import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCallTelegramApi = vi.fn()
const mockValidatePreCheckoutIntent = vi.fn()
const mockFulfillPaidIntent = vi.fn()

vi.mock('./telegram-http.service', () => ({
  callTelegramApi: (...args: unknown[]) => mockCallTelegramApi(...args),
}))

vi.mock('./yookassa/order-from-payment.service', () => ({
  fulfillPaidIntent: (...args: unknown[]) => mockFulfillPaidIntent(...args),
  parseIntentPayload: (payload: string) => {
    const m = payload.match(/^intent:(\d+)$/)
    if (!m) return null
    const id = Number(m[1])
    return Number.isInteger(id) && id > 0 ? id : null
  },
  validatePreCheckoutIntent: (...args: unknown[]) => mockValidatePreCheckoutIntent(...args),
}))

vi.mock('../utils/env', () => ({
  env: { telegramBotToken: 'test-token' },
}))

import { handlePreCheckoutQuery, handleSuccessfulPayment } from './telegram-bot.service'

describe('telegram-bot payment handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallTelegramApi.mockResolvedValue(true)
  })

  it('answers pre_checkout ok when intent is valid', async () => {
    mockValidatePreCheckoutIntent.mockResolvedValue({ ok: true })

    await handlePreCheckoutQuery({
      id: 'pcq-1',
      from: { id: 123 },
      currency: 'RUB',
      total_amount: 100000,
      invoice_payload: 'intent:7',
    })

    expect(mockValidatePreCheckoutIntent).toHaveBeenCalledWith(7, 123, 100000)
    expect(mockCallTelegramApi).toHaveBeenCalledWith('answerPreCheckoutQuery', {
      pre_checkout_query_id: 'pcq-1',
      ok: true,
    })
  })

  it('rejects invalid invoice payload', async () => {
    await handlePreCheckoutQuery({
      id: 'pcq-2',
      from: { id: 123 },
      currency: 'RUB',
      total_amount: 100000,
      invoice_payload: 'bad-payload',
    })

    expect(mockValidatePreCheckoutIntent).not.toHaveBeenCalled()
    expect(mockCallTelegramApi).toHaveBeenCalledWith('answerPreCheckoutQuery', {
      pre_checkout_query_id: 'pcq-2',
      ok: false,
      error_message: 'Неверный платёж',
    })
  })

  it('fulfills intent on successful_payment', async () => {
    mockFulfillPaidIntent.mockResolvedValue(99)

    await handleSuccessfulPayment(
      {
        currency: 'RUB',
        total_amount: 100000,
        invoice_payload: 'intent:7',
        telegram_payment_charge_id: 'tg-charge-1',
      },
      123,
    )

    expect(mockFulfillPaidIntent).toHaveBeenCalledWith(7, 'tg-charge-1')
  })
})
