import { env } from '../utils/env'
import { getBotWelcomeSettings } from './bot-welcome.service'
import { buildStartInlineKeyboard } from './telegram-bot-menu'
import { callTelegramApi } from './telegram-http.service'

type TelegramUpdate = {
  update_id: number
  message?: {
    text?: string
    chat?: { id: number }
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

const pollOnce = async (): Promise<void> => {
  const updates = await callTelegramApi<TelegramUpdate[]>('getUpdates', {
    offset: lastUpdateId + 1,
    timeout: 20,
    allowed_updates: ['message'],
  })

  for (const update of updates) {
    lastUpdateId = update.update_id
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
