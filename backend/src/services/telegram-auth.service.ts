import crypto from 'node:crypto'

export type TelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date?: number
}

/**
 * Валидирует initData от Telegram WebApp.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export const validateTelegramInitData = (
  initData: string,
  botToken: string,
): TelegramUser | null => {
  try {
    const params = new URLSearchParams(initData)
    const receivedHash = params.get('hash')
    if (!receivedHash) return null

    params.delete('hash')

    // Строим data_check_string — параметры в алфавитном порядке
    const dataCheckArr: string[] = []
    params.sort()
    params.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`)
    })
    const dataCheckString = dataCheckArr.join('\n')

    // secret_key = HMAC-SHA256("WebAppData", bot_token)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()

    // hash = HMAC-SHA256(data_check_string, secret_key)
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    if (calculatedHash !== receivedHash) return null

    // Проверяем auth_date — не старше 24 часов
    const authDate = Number(params.get('auth_date') ?? 0)
    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > 86400) return null

    // Парсим user
    const rawUser = params.get('user')
    if (!rawUser) return null
    const user = JSON.parse(rawUser) as TelegramUser
    if (!Number.isInteger(user.id)) return null

    return user
  } catch {
    return null
  }
}

/**
 * Для DEV-окружения: если initData пустой и задан DEV_TELEGRAM_USER_ID,
 * возвращаем фейкового пользователя без проверки подписи.
 * НА ПРОДЕ ЭТОТ ПУТЬ НЕДОСТУПЕН.
 */
export const getDevFallbackUser = (devUserId?: string): TelegramUser | null => {
  if (process.env.NODE_ENV === 'production') return null
  const id = Number(devUserId)
  if (!Number.isInteger(id) || id <= 0) return null
  return { id, first_name: 'Dev', username: 'dev_user' }
}
