/** Reads Telegram WebApp initData for API requests (maintenance bypass for admins). */
export const getTelegramInitDataForApi = (): string => {
  const webApp = window.Telegram?.WebApp
  if (webApp?.initData) return webApp.initData

  try {
    const url = new URL(window.location.href)
    const fromQuery = url.searchParams.get('tgWebAppData')
    if (fromQuery) return fromQuery

    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
    if (!hash) return isNonProduction() ? 'dev_fallback' : ''
    const hashParams = new URLSearchParams(hash)
    const fromHash = hashParams.get('tgWebAppData')
    if (fromHash) return fromHash
  } catch {
    // ignore malformed URL
  }

  return isNonProduction() ? 'dev_fallback' : ''
}

const isNonProduction = (): boolean => import.meta.env.MODE !== 'production'
