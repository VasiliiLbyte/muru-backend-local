import { env } from '../utils/env'
import { getBotWelcomeSettings } from './bot-welcome.service'
import { buildStartInlineKeyboard } from './telegram-bot-menu'
import { callTelegramApi } from './telegram-http.service'
import {
  fulfillPaidIntent,
  parseIntentPayload,
  validatePreCheckoutIntent,
} from './yookassa/order-from-payment.service'

type TelegramSuccessfulPayment = {
  currency: string
  total_amount: number
  invoice_payload: string
  telegram_payment_charge_id: string
  provider_payment_charge_id?: string
}

type TelegramUpdate = {
  update_id: number
  pre_checkout_query?: {
    id: string
    from: { id: number }
    currency: string
    total_amount: number
    invoice_payload: string
  }
  message?: {
    text?: string
    chat?: { id: number }
    from?: { id: number }
    successful_payment?: TelegramSuccessfulPayment
  }
}

let pollingStarted = false
let lastUpdateId = 0
let profileConfigured = false

const BOT_WELCOME_SHORT_MAX = 120

const buildShortDescription = (description: string): string => {
  const trimmed = description.trim()
  if (trimmed.length <= BOT_WELCOME_SHORT_MAX) return trimmed
  const slice = trimmed.slice(0, BOT_WELCOME_SHORT_MAX)
  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace > 40) return `${slice.slice(0, lastSpace)}…`
  return `${slice}…`
}

export const configureTelegramBotProfile = async (): Promise<void> => {
  if (!env.telegramBotToken || profileConfigured) return
  profileConfigured = true

  try {
    await callTelegramApi('setMyDescription', {
      description: env.botWelcomeDescription,
    })
    await callTelegramApi('setMyShortDescription', {
      short_description: buildShortDescription(env.botWelcomeDescription),
    })
  } catch (error) {
    console.error('[telegram-bot] failed to set bot description', error)
    profileConfigured = false
  }
}

const getStartCaption = (): string => env.botWelcomeMessage

const getStartReplyMarkup = () => ({
  inline_keyboard: buildStartInlineKeyboard({
    miniAppUrl: env.telegramMiniAppUrl,
    siteUrl: env.botSiteUrl,
    channelUrl: env.botChannelUrl,
    careUrl: env.botCareUrl,
    deliveryUrl: env.botDeliveryUrl,
  }),
})

const sendStartMessage = async (chatId: number) => {
  const caption = getStartCaption()
  const replyMarkup = getStartReplyMarkup()
  const welcome = await getBotWelcomeSettings()
  const photoUrl = welcome.welcomeImageUrl?.trim()

  if (photoUrl) {
    await callTelegramApi('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      reply_markup: replyMarkup,
    })
    return
  }

  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: caption,
    reply_markup: replyMarkup,
  })
}

const handlePreCheckoutQuery = async (
  query: NonNullable<TelegramUpdate['pre_checkout_query']>,
): Promise<void> => {
  const intentId = parseIntentPayload(query.invoice_payload)
  if (!intentId) {
    await callTelegramApi('answerPreCheckoutQuery', {
      pre_checkout_query_id: query.id,
      ok: false,
      error_message: 'Неверный платёж',
    })
    return
  }

  const validation = await validatePreCheckoutIntent(
    intentId,
    query.from.id,
    query.total_amount,
  )

  await callTelegramApi('answerPreCheckoutQuery', {
    pre_checkout_query_id: query.id,
    ok: validation.ok,
    ...(validation.ok ? {} : { error_message: validation.errorMessage }),
  })
}

const handleSuccessfulPayment = async (
  payment: TelegramSuccessfulPayment,
  fromId: number | undefined,
): Promise<void> => {
  const intentId = parseIntentPayload(payment.invoice_payload)
  if (!intentId) {
    console.error('[tg-pay] invalid invoice payload', payment.invoice_payload)
    return
  }

  try {
    const orderId = await fulfillPaidIntent(intentId, payment.telegram_payment_charge_id)
    console.log('[tg-pay] fulfill', { intentId, orderId, fromId })
  } catch (error) {
    console.error('[tg-pay] fulfill failed', { intentId, error })
  }
}

const pollOnce = async (): Promise<void> => {
  const updates = await callTelegramApi<TelegramUpdate[]>('getUpdates', {
    offset: lastUpdateId + 1,
    timeout: 20,
    allowed_updates: ['message', 'pre_checkout_query'],
  })

  for (const update of updates) {
    lastUpdateId = update.update_id

    if (update.pre_checkout_query) {
      await handlePreCheckoutQuery(update.pre_checkout_query).catch((error) => {
        console.error('[telegram-bot] pre_checkout_query error', error)
      })
      continue
    }

    const successfulPayment = update.message?.successful_payment
    if (successfulPayment) {
      await handleSuccessfulPayment(successfulPayment, update.message?.from?.id)
      continue
    }

    const text = update.message?.text?.trim()
    const chatId = update.message?.chat?.id

    if (text === '/start' && chatId) {
      await sendStartMessage(chatId)
    }
  }
}

export const startTelegramBotPolling = () => {
  if (pollingStarted || !env.telegramBotToken) return
  pollingStarted = true

  void configureTelegramBotProfile()

  const loop = async () => {
    try {
      await pollOnce()
    } catch (error) {
      console.error('[telegram-bot] polling error', error)
    } finally {
      setTimeout(loop, 1500)
    }
  }

  loop().catch((error) => {
    console.error('[telegram-bot] failed to start loop', error)
  })
}

export { handlePreCheckoutQuery, handleSuccessfulPayment }

export type { TelegramUpdate }
