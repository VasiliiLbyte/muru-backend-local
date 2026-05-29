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
  /** Показать системное подтверждение при закрытии Mini App (крестик в Telegram). */
  enableClosingConfirmation?: () => void
  disableClosingConfirmation?: () => void
  /** Bot API 7.7+: свайп вниз по контенту не сворачивает Mini App (только шапка TG). */
  disableVerticalSwipes?: () => void
  enableVerticalSwipes?: () => void
  isVerticalSwipesEnabled?: boolean
  close?: () => void
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void
    selectionChanged?: () => void
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}
