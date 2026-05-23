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
  const mini = menu.miniAppUrl.trim()
  const rows: Array<InlineKeyboardButton[] | null> = [
    row(webAppButton('🛋 Посмотреть каталог', mini)),
    row(
      webAppButton('🛒 Корзина', mini ? appendTab(mini, 'cart') : ''),
      urlButton('📦 Доставка и возврат', menu.deliveryUrl),
    ),
    row(
      webAppButton('✨ Новинки', mini ? appendTab(mini, 'catalog') : ''),
      webAppButton('🤍 Избранное', mini ? appendTab(mini, 'favorites') : ''),
    ),
    row(urlButton('💬 Бюро заботы', menu.careUrl)),
    row(urlButton('🏡 Сайт MURU', menu.siteUrl)),
    row(urlButton('📣 Telegram - канал MURU', menu.channelUrl)),
  ]
  return rows.filter((r): r is InlineKeyboardButton[] => r !== null)
}
