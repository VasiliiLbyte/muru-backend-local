import { ProxyAgent, fetch as undiciFetch, type Dispatcher } from 'undici'

import { env } from '../utils/env'

const proxyUrl =
  process.env.NODE_ENV !== 'production'
    ? process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || ''
    : ''

const dispatcher: Dispatcher | undefined = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

type TelegramApiResponse<T> = {
  ok: boolean
  result: T
  description?: string
}

export const callTelegramApi = async <T>(method: string, body: Record<string, unknown>): Promise<T> => {
  if (!env.telegramBotToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required for Telegram notifications')
  }

  const response = await undiciFetch(`https://api.telegram.org/bot${env.telegramBotToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    dispatcher,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Telegram API ${method} failed: ${errorBody}`)
  }

  const payload = (await response.json()) as TelegramApiResponse<T>
  if (!payload.ok) {
    throw new Error(payload.description || `Telegram API ${method} returned not ok`)
  }

  return payload.result
}
