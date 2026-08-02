import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSendEmail, envState } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  envState: {
    orderManagerEmail: 'sale@muru.ru',
    emailReplyTo: 'info@muru.ru',
    emailFromName: 'MURU',
  },
}))

vi.mock('./email.service', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))

vi.mock('../utils/env', () => ({
  env: envState,
}))

import type { OrderDraft } from '../types/order'
import {
  buildCustomerOrderEmailHtml,
  buildManagerOrderEmailHtml,
  sendOrderEmails,
} from './order-email.service'

const order: OrderDraft = {
  id: 42,
  telegramUserId: null,
  status: 'Оплачен',
  deliveryMode: 'delivery',
  deliveryOption: 'ПВЗ',
  deliveryPrice: 350,
  deliveryEta: '3-5 дней',
  address: 'СПб, Невский 1',
  comment: '',
  birthDate: null,
  subtotal: 1000,
  total: 1350,
  cdekPvzAddress: 'ПВЗ на Невском',
  recipientName: 'Иван',
  recipientPhone: '+79001234567',
  items: [
    {
      sku: 'MU0001',
      name: 'Ваза',
      price: 1000,
      quantity: 1,
      color: 'белый',
      size: 'M',
    },
  ],
}

describe('order-email.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    envState.orderManagerEmail = 'sale@muru.ru'
    envState.emailReplyTo = 'info@muru.ru'
    mockSendEmail.mockResolvedValue(undefined)
  })

  it('buildCustomerOrderEmailHtml includes brand blocks and totals', () => {
    const html = buildCustomerOrderEmailHtml(order, { recipientName: 'Иван' })
    expect(html).toContain('MURU')
    expect(html).toContain('#5D6B3A')
    expect(html).toContain('Спасибо за заказ, Иван!')
    expect(html).toContain('Заказ #42')
    expect(html).toContain('Ваза')
    expect(html).toContain('белый / M')
    expect(html).toContain('1000.00 ₽')
    expect(html).toContain('Подытог')
    expect(html).toContain('Доставка')
    expect(html).toContain('Итого')
    expect(html).toContain('ПВЗ на Невском')
    expect(html).toContain('info@muru.ru')
  })

  it('buildManagerOrderEmailHtml includes contacts and admin link', () => {
    const html = buildManagerOrderEmailHtml(order, {
      recipientName: 'Иван',
      email: 'buyer@example.com',
      phone: '+79001234567',
    })
    expect(html).toContain('Новый оплаченный заказ #42')
    expect(html).toContain('buyer@example.com')
    expect(html).toContain('+79001234567')
    expect(html).toContain('https://murushop.ru/admin/orders/42')
    expect(html).toContain('Ваза')
  })

  it('sendOrderEmails with email calls sendEmail twice and passes replyTo for customer', async () => {
    await sendOrderEmails(order, {
      email: 'buyer@example.com',
      recipientName: 'Иван',
      phone: '+79001234567',
    })

    expect(mockSendEmail).toHaveBeenCalledTimes(2)
    expect(mockSendEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: 'buyer@example.com',
        subject: 'Заказ #42 принят — MURU',
        replyTo: 'info@muru.ru',
      }),
    )
    expect(mockSendEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: 'sale@muru.ru',
        subject: 'Новый оплаченный заказ #42',
      }),
    )
  })

  it('sendOrderEmails without email sends only manager mail', async () => {
    await sendOrderEmails(order, {
      recipientName: 'Иван',
      phone: '+79001234567',
    })

    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sale@muru.ru',
        subject: 'Новый оплаченный заказ #42',
      }),
    )
  })

  it('sendOrderEmails still sends manager mail when customer send fails', async () => {
    mockSendEmail
      .mockRejectedValueOnce(new Error('customer fail'))
      .mockResolvedValueOnce(undefined)

    await sendOrderEmails(order, {
      email: 'buyer@example.com',
      recipientName: 'Иван',
    })

    expect(mockSendEmail).toHaveBeenCalledTimes(2)
    expect(mockSendEmail.mock.calls[1][0]).toEqual(
      expect.objectContaining({ to: 'sale@muru.ru' }),
    )
  })

  it('sendOrderEmails still attempts customer mail when manager send fails', async () => {
    mockSendEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('manager fail'))

    await expect(
      sendOrderEmails(order, {
        email: 'buyer@example.com',
        recipientName: 'Иван',
      }),
    ).resolves.toBeUndefined()

    expect(mockSendEmail).toHaveBeenCalledTimes(2)
    expect(mockSendEmail.mock.calls[0][0]).toEqual(
      expect.objectContaining({ to: 'buyer@example.com' }),
    )
  })

  it('sendOrderEmails skips manager when ORDER_MANAGER_EMAIL is empty', async () => {
    envState.orderManagerEmail = ''

    await sendOrderEmails(order, {
      email: 'buyer@example.com',
    })

    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'buyer@example.com' }),
    )
  })
})
