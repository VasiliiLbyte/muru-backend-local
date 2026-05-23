import { describe, expect, it } from 'vitest'

import { buildStartInlineKeyboard } from './telegram-bot-menu'

const fullMenu = {
  miniAppUrl: 'https://murushop.online',
  siteUrl: 'https://murushop.online/site',
  channelUrl: 'https://t.me/muru_channel',
  careUrl: 'https://murushop.online/care',
  deliveryUrl: 'https://murushop.online/delivery',
}

describe('buildStartInlineKeyboard', () => {
  it('builds six rows with expected labels when all URLs are set', () => {
    const keyboard = buildStartInlineKeyboard(fullMenu)
    expect(keyboard).toHaveLength(6)
    expect(keyboard[0]).toEqual([
      { text: 'Посмотреть каталог', web_app: { url: 'https://murushop.online' } },
    ])
    expect(keyboard[1][0]).toMatchObject({ text: 'Корзина' })
    expect(keyboard[1][0]).toHaveProperty('web_app.url', 'https://murushop.online/?tab=cart')
    expect(keyboard[1][1]).toEqual({
      text: 'Доставка и возврат',
      url: fullMenu.deliveryUrl,
    })
    expect(keyboard[2][0]).toHaveProperty('web_app.url', 'https://murushop.online/?tab=catalog')
    expect(keyboard[2][1]).toHaveProperty('web_app.url', 'https://murushop.online/?tab=favorites')
    expect(keyboard[3][0].text).toBe('Бюро заботы')
    expect(keyboard[4][0].text).toBe('Сайт MURU')
    expect(keyboard[5][0].text).toBe('Telegram - канал MURU')
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
      ['Посмотреть каталог'],
      ['Корзина'],
      ['Новинки', 'Избранное'],
    ])
  })
})
