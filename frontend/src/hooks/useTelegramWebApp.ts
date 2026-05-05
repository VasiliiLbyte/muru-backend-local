import { useEffect, useMemo, useState } from 'react'
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
  const [webApp, setWebApp] = useState<TelegramWebApp | undefined>(
    window.Telegram?.WebApp,
  )

  useEffect(() => {
    const app = window.Telegram?.WebApp
    if (!app) return

    app.ready()
    app.expand()
    app.BackButton.hide()
    app.MainButton.setText('Оформить заказ')
    app.MainButton.show()

    if (app.themeParams) {
      Object.entries(app.themeParams).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--tg-${key}`, value)
      })
    }

    setWebApp(app)
  }, [])

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
