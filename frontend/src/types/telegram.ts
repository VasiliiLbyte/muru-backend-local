export type TelegramWebAppUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

export type TelegramWebApp = {
  initData?: string
  initDataUnsafe?: {
    user?: TelegramWebAppUser
  }
  themeParams?: Record<string, string>
  ready: () => void
  expand: () => void
  BackButton: {
    show: () => void
    hide: () => void
    onClick?: (handler: () => void) => void
    offClick?: (handler: () => void) => void
  }
  MainButton: {
    setText: (text: string) => void
    show: () => void
    hide: () => void
    onClick: (handler: () => void) => void
    offClick: (handler: () => void) => void
    enable: () => void
    disable: () => void
  }
  close?: () => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}
