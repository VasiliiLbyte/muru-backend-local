import { env } from '../utils/env'
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

const sendStartMessage = async (chatId: number) => {
  const miniAppUrl = env.telegramMiniAppUrl?.trim()

  if (miniAppUrl) {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: 'Добро пожаловать в MURU Mini App. Нажмите кнопку ниже, чтобы открыть приложение.',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Открыть MURU Mini App',
              web_app: { url: miniAppUrl },
            },
          ],
        ],
      },
    })
    return
  }

  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: 'Бот подключен. Для открытия Mini App добавьте TELEGRAM_MINI_APP_URL в env.',
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
