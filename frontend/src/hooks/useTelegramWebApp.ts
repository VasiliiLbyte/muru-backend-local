import { useEffect, useMemo } from 'react'
import '@tma.js/sdk'

import type { TelegramWebApp } from '../types/telegram'

const parseAdminIds = (rawValue?: string): number[] => {
  if (!rawValue) return []

  return rawValue
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isInteger(value))
}

export const useTelegramWebApp = () => {
  const webApp: TelegramWebApp | undefined = useMemo(() => window.Telegram?.WebApp, [])

  useEffect(() => {
    if (!webApp) return

    webApp.ready()
    webApp.expand()
    webApp.BackButton.hide()
    webApp.MainButton.setText('Оформить заказ')
    webApp.MainButton.show()

    if (webApp.themeParams) {
      Object.entries(webApp.themeParams).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--tg-${key}`, value)
      })
    }
  }, [webApp])

  const userId = webApp?.initDataUnsafe?.user?.id
  const adminIds = useMemo(
    () => parseAdminIds(import.meta.env.VITE_ADMIN_IDS),
    [],
  )

  return {
    webApp,
    userId,
    isAdmin: userId !== undefined && adminIds.includes(userId),
  }
}
