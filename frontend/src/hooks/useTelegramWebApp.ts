import { useEffect, useMemo, useState } from 'react'

import { authenticateWithTelegram, clearToken } from '../lib/auth'
import { fetchAdminAccess } from '../lib/api'
import type { TelegramWebApp } from '../types/telegram'

const parseAdminIds = (rawValue?: string): number[] => {
  if (!rawValue) return []

  return rawValue
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isInteger(value))
}

const parseUserIdFromInitData = (rawInitData?: string): number | undefined => {
  if (!rawInitData) return undefined

  try {
    const params = new URLSearchParams(rawInitData)
    const rawUser = params.get('user')
    if (!rawUser) return undefined
    const parsed = JSON.parse(rawUser) as { id?: number }
    return Number.isInteger(parsed.id) ? parsed.id : undefined
  } catch {
    return undefined
  }
}

const parseUserIdFromLaunchParams = (): number | undefined => {
  try {
    const url = new URL(window.location.href)
    const fromQuery = url.searchParams.get('tgWebAppData')
    if (fromQuery) {
      return parseUserIdFromInitData(fromQuery)
    }

    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
    if (!hash) return undefined
    const hashParams = new URLSearchParams(hash)
    const fromHash = hashParams.get('tgWebAppData')
    if (fromHash) {
      return parseUserIdFromInitData(fromHash)
    }
    return undefined
  } catch {
    return undefined
  }
}

const parseInitDataFromLaunchParams = (): string | undefined => {
  try {
    const url = new URL(window.location.href)
    const fromQuery = url.searchParams.get('tgWebAppData')
    if (fromQuery) return fromQuery

    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
    if (!hash) return undefined
    const hashParams = new URLSearchParams(hash)
    return hashParams.get('tgWebAppData') ?? undefined
  } catch {
    return undefined
  }
}

const isNonProduction = (): boolean =>
  (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production'

export const useTelegramWebApp = () => {
  const webApp: TelegramWebApp | undefined = useMemo(() => window.Telegram?.WebApp, [])
  const [authUserId, setAuthUserId] = useState<number | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)

  const viteAdminIds = useMemo(
    () => parseAdminIds(import.meta.env.VITE_ADMIN_IDS),
    [],
  )

  useEffect(() => {
    if (!webApp) return

    webApp.ready()
    webApp.expand()
    webApp.disableVerticalSwipes?.()
    webApp.BackButton.hide()
    webApp.MainButton.hide()
    webApp.enableClosingConfirmation?.()

    if (webApp.themeParams) {
      Object.entries(webApp.themeParams).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--tg-${key}`, value)
      })
    }
  }, [webApp])

  useEffect(() => {
    const runAuth = async () => {
      const initData = webApp?.initData || parseInitDataFromLaunchParams()
      const effectiveInitData = initData || (isNonProduction() ? 'dev_fallback' : '')
      if (!effectiveInitData) {
        const unsafeId = webApp?.initDataUnsafe?.user?.id
        if (Number.isInteger(unsafeId)) setAuthUserId(unsafeId)
        return
      }

      try {
        const authResult = await authenticateWithTelegram(effectiveInitData)
        setAuthUserId(authResult.user.telegramId)
      } catch {
        clearToken()
        const fallbackId =
          webApp?.initDataUnsafe?.user?.id ??
          parseUserIdFromInitData(initData) ??
          parseUserIdFromLaunchParams()
        setAuthUserId(Number.isInteger(fallbackId) ? fallbackId : undefined)
      }
    }

    void runAuth()
  }, [webApp])

  const userId = useMemo(() => {
    if (Number.isInteger(authUserId)) return authUserId
    const unsafeUserId = webApp?.initDataUnsafe?.user?.id
    if (Number.isInteger(unsafeUserId)) return unsafeUserId
    const initDataUserId = parseUserIdFromInitData(webApp?.initData)
    if (Number.isInteger(initDataUserId)) return initDataUserId
    return parseUserIdFromLaunchParams()
  }, [authUserId, webApp])

  useEffect(() => {
    if (!Number.isInteger(userId)) {
      setIsAdmin(false)
      return
    }

    let cancelled = false

    void fetchAdminAccess(userId!)
      .then((fromApi) => {
        if (!cancelled) setIsAdmin(fromApi)
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(viteAdminIds.includes(userId!))
      })

    return () => {
      cancelled = true
    }
  }, [userId, viteAdminIds])

  return {
    webApp,
    userId,
    isAdmin,
  }
}
