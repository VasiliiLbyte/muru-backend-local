export type InlineKeyboardButton =
  | { text: string; web_app: { url: string } }
  | { text: string; url: string }

export type BotMenuEnv = {
  miniAppUrl: string
  siteUrl: string
  channelUrl: string
  careUrl: string
  deliveryUrl: string
}

/** web_app must open /catalog — root URL often shows blank screen in Telegram WebView. */
export const resolveMiniAppCatalogBase = (miniAppUrl: string): string => {
  const trimmed = miniAppUrl.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    const path = url.pathname.replace(/\/$/, '') || '/'
    if (path === '/' || !path.startsWith('/catalog')) {
      url.pathname = '/catalog'
    }
    return url.toString()
  } catch {
    if (trimmed.includes('/catalog')) return trimmed
    return `${trimmed.replace(/\/+$/, '')}/catalog`
  }
}

const appendTab = (baseUrl: string, tab: string): string => {
  try {
    const url = new URL(baseUrl)
    url.searchParams.set('tab', tab)
    return url.toString()
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}tab=${encodeURIComponent(tab)}`
  }
}

const webAppButton = (text: string, url: string): InlineKeyboardButton | null =>
  url.trim() ? { text, web_app: { url: url.trim() } } : null

const urlButton = (text: string, url: string): InlineKeyboardButton | null =>
  url.trim() ? { text, url: url.trim() } : null

const row = (...buttons: Array<InlineKeyboardButton | null>): InlineKeyboardButton[] | null => {
  const filtered = buttons.filter((b): b is InlineKeyboardButton => b !== null)
  return filtered.length > 0 ? filtered : null
}

export const buildStartInlineKeyboard = (menu: BotMenuEnv): InlineKeyboardButton[][] => {
  const catalogBase = resolveMiniAppCatalogBase(menu.miniAppUrl)
  const rows: Array<InlineKeyboardButton[] | null> = [
    row(webAppButton('🛋 Посмотреть каталог', catalogBase)),
    row(
      webAppButton('🛒 Корзина', catalogBase ? appendTab(catalogBase, 'cart') : ''),
      urlButton('📦 Доставка и возврат', menu.deliveryUrl),
    ),
    row(
      webAppButton('✨ Новинки', catalogBase ? appendTab(catalogBase, 'catalog') : ''),
      webAppButton('🤍 Избранное', catalogBase ? appendTab(catalogBase, 'favorites') : ''),
    ),
    row(urlButton('💬 Бюро заботы', menu.careUrl)),
    row(urlButton('🏡 Сайт MURU', menu.siteUrl)),
    row(urlButton('📣 Telegram - канал MURU', menu.channelUrl)),
  ]
  return rows.filter((r): r is InlineKeyboardButton[] => r !== null)
}
