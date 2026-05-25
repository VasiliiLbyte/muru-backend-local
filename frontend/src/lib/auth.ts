import { getViteApiBaseUrl } from './api-base-url'
import { parseApi } from './api-response'

const API_BASE_URL = getViteApiBaseUrl()
const TOKEN_STORAGE_KEY = 'muru_auth_token'

type TelegramAuthResponse = {
  token: string
  user: {
    id: number
    telegramId: number
    firstName?: string
    username?: string
  }
}

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_STORAGE_KEY)

export const storeToken = (token: string): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export const authenticateWithTelegram = async (initData: string): Promise<TelegramAuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  })
  const data = await parseApi<TelegramAuthResponse>(response)
  storeToken(data.token)
  return data
}
