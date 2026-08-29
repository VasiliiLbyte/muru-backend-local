import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()

vi.stubGlobal('fetch', mockFetch)

vi.mock('../../utils/env', () => ({
  env: {
    flashcallConfigured: true,
    flashcallTestMode: false,
    streamTelecomLogin: 'test-login',
    streamTelecomPass: 'test-pass',
    streamTelecomCallbackUrl: '',
    streamTelecomSmsSender: 'muru.ru',
    nodeEnv: 'development',
  },
}))

import {
  phoneToStreamTelecomDigits,
  sendFlashCall,
  sendSms,
  StreamTelecomError,
} from './streamtelecom.service'

describe('streamtelecom.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('phoneToStreamTelecomDigits converts +7 format to 11 digits', () => {
    expect(phoneToStreamTelecomDigits('+79219449115')).toBe('79219449115')
  })

  it('sendFlashCall posts form body and parses Success JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      text: async () => JSON.stringify({ result: 'Success', code: '2424' }),
    })

    const result = await sendFlashCall({ phone: '+79219449115', code: 2424 })

    expect(result.code).toBe('2424')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://gateway.api.sc/flash/')
    expect(init.method).toBe('POST')
    const body = String(init.body)
    expect(body).toContain('login=test-login')
    expect(body).toContain('type=flash')
    expect(body).toContain('phone=79219449115')
    expect(body).toContain('code=2424')
    expect(body).toContain('capacity=4')
    expect(body).toMatch(/pass=/)
  })

  it('sendFlashCall maps Error JSON to StreamTelecomError', async () => {
    mockFetch.mockResolvedValueOnce({
      text: async () =>
        JSON.stringify({ result: 'Error', message: 'Too many requests' }),
    })

    await expect(sendFlashCall({ phone: '+79219449115', code: 1234 })).rejects.toMatchObject({
      message: 'Too many requests',
    })
  })

  it('uses test endpoint when FLASHCALL_TEST_MODE is enabled', async () => {
    const envModule = await import('../../utils/env')
    const original = envModule.env.flashcallTestMode
    envModule.env.flashcallTestMode = true

    mockFetch.mockResolvedValueOnce({
      text: async () => JSON.stringify({ result: 'Success', code: '5678' }),
    })

    await sendFlashCall({ phone: '+79219449115', code: 5678 })

    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toBe('https://gateway.api.sc/test_post.php')

    envModule.env.flashcallTestMode = original
  })

  it('rejects invalid code length', async () => {
    await expect(sendFlashCall({ phone: '+79219449115', code: 99 })).rejects.toThrow(
      'Code must be four digits',
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sendSms performs GET with query params and parses numeric id', async () => {
    mockFetch.mockResolvedValueOnce({
      text: async () => '123456789',
    })

    const result = await sendSms({
      phone: '+79219449115',
      text: 'Код для входа на muru.ru: 1234',
    })

    expect(result.id).toBe('123456789')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit | undefined]
    expect(url).toContain('https://gateway.api.sc/get/?')
    expect(url).toContain('user=test-login')
    expect(url).toContain('pwd=test-pass')
    expect(url).toContain('sadr=muru.ru')
    expect(url).toContain('dadr=79219449115')
    expect(new URL(url).searchParams.get('text')).toBe('Код для входа на muru.ru: 1234')
    expect(init?.method).toBe('GET')
  })

  it('sendSms maps error text to StreamTelecomError', async () => {
    mockFetch.mockResolvedValueOnce({
      text: async () => 'Unknown sender',
    })

    await expect(
      sendSms({ phone: '+79219449115', text: 'Код для входа на muru.ru: 1234' }),
    ).rejects.toMatchObject({
      message: 'Unknown sender',
    })
  })

  it('sendSms short-circuits in test nodeEnv', async () => {
    const envModule = await import('../../utils/env')
    const originalNodeEnv = envModule.env.nodeEnv
    envModule.env.nodeEnv = 'test'

    const result = await sendSms({ phone: '+79219449115', text: 'test' })

    expect(result).toEqual({ id: 'test-sms-id' })
    expect(mockFetch).not.toHaveBeenCalled()

    envModule.env.nodeEnv = originalNodeEnv
  })
})
