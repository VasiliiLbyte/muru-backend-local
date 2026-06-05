import { describe, expect, it } from 'vitest'

import { buildStartInlineKeyboard, resolveMiniAppCatalogBase } from './telegram-bot-menu'

const fullMenu = {
  miniAppUrl: 'https://murushop.online',
  siteUrl: 'https://murushop.online/site',
  channelUrl: 'https://t.me/muru_channel',
  careUrl: 'https://murushop.online/care',
  deliveryUrl: 'https://murushop.online/delivery',
}

describe('resolveMiniAppCatalogBase', () => {
  it('appends /catalog when env URL is site root', () => {
    expect(resolveMiniAppCatalogBase('https://murushop.online')).toBe('https://murushop.online/catalog')
    expect(resolveMiniAppCatalogBase('https://murushop.online/catalog?v=4')).toBe(
      'https://murushop.online/catalog?v=4',
    )
  })
})

describe('buildStartInlineKeyboard', () => {
  it('builds six rows with expected labels when all URLs are set', () => {
    const keyboard = buildStartInlineKeyboard(fullMenu)
    expect(keyboard).toHaveLength(6)
    expect(keyboard[0]).toEqual([
      { text: '🛋 Посмотреть каталог', web_app: { url: 'https://murushop.online/catalog' } },
    ])
    expect(keyboard[1][0]).toMatchObject({ text: '🛒 Корзина' })
    expect(keyboard[1][0]).toHaveProperty('web_app.url', 'https://murushop.online/catalog?tab=cart')
    expect(keyboard[1][1]).toEqual({
      text: '📦 Доставка и возврат',
      url: fullMenu.deliveryUrl,
    })
    expect(keyboard[2][0]).toMatchObject({ text: '✨ Новинки' })
    expect(keyboard[2][0]).toHaveProperty('web_app.url', 'https://murushop.online/catalog?tab=catalog')
    expect(keyboard[2][1]).toMatchObject({ text: '🤍 Избранное' })
    expect(keyboard[2][1]).toHaveProperty('web_app.url', 'https://murushop.online/catalog?tab=favorites')
    expect(keyboard[3][0].text).toBe('💬 Бюро заботы')
    expect(keyboard[4][0]).toEqual({
      text: '🏡 Сайт MURU',
      url: fullMenu.siteUrl,
    })
    expect(keyboard[5][0]).toEqual({
      text: '📣 Telegram - канал MURU',
      url: fullMenu.channelUrl,
    })
  })

  it('includes site and channel url buttons with production URLs', () => {
    const keyboard = buildStartInlineKeyboard({
      ...fullMenu,
      siteUrl: 'https://muru.ru',
      channelUrl: 'https://t.me/muru_online',
    })
    expect(keyboard[4][0]).toEqual({ text: '🏡 Сайт MURU', url: 'https://muru.ru' })
    expect(keyboard[5][0]).toEqual({
      text: '📣 Telegram - канал MURU',
      url: 'https://t.me/muru_online',
    })
  })

  it('omits rows with no valid buttons', () => {
    const keyboard = buildStartInlineKeyboard({
      miniAppUrl: 'https://murushop.online',
      siteUrl: '',
      channelUrl: '',
      careUrl: '',
      deliveryUrl: '',
    })
    expect(keyboard).toHaveLength(3)
    expect(keyboard.map((r) => r.map((b) => b.text))).toEqual([
      ['🛋 Посмотреть каталог'],
      ['🛒 Корзина'],
      ['✨ Новинки', '🤍 Избранное'],
    ])
  })
})
