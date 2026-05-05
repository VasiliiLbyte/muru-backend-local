export type TelegramWebAppUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

export type TelegramWebApp = {
  initDataUnsafe?: {
    user?: TelegramWebAppUser
  }
  themeParams?: Record<string, string>
  ready: () => void
  expand: () => void
  BackButton: { show: () => void; hide: () => void }
  MainButton: {
    setText: (text: string) => void
    show: () => void
    hide: () => void
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}
