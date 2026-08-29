import { normalizeRussianPhone } from '../cdek/phone'
import { env } from '../../utils/env'

const PROD_FLASH_ENDPOINT = 'https://gateway.api.sc/flash/'
const TEST_FLASH_ENDPOINT = 'https://gateway.api.sc/test_post.php'
const SMS_ENDPOINT = 'https://gateway.api.sc/get/'
const SMS_SUCCESS_ID_PATTERN = /^\d+(,\d+)*$/

export class StreamTelecomError extends Error {
  readonly providerMessage: string

  constructor(providerMessage: string) {
    super(providerMessage)
    this.name = 'StreamTelecomError'
    this.providerMessage = providerMessage
  }
}

type StreamTelecomResponse = {
  result?: string
  code?: string
  message?: string
}

export const phoneToStreamTelecomDigits = (normalizedPhone: string): string => {
  const digits = normalizedPhone.replace(/\D/g, '')
  if (digits.length !== 11 || !digits.startsWith('7')) {
    throw new StreamTelecomError('Not correct phone')
  }
  return digits
}

const resolveFlashEndpoint = (): string =>
  env.flashcallTestMode ? TEST_FLASH_ENDPOINT : PROD_FLASH_ENDPOINT

export const sendFlashCall = async (input: {
  phone: string
  code: number
}): Promise<{ code: string }> => {
  if (!env.flashcallConfigured) {
    throw new StreamTelecomError('Flash call provider is not configured')
  }

  if (input.code < 1000 || input.code > 9999) {
    throw new StreamTelecomError('Code must be four digits')
  }

  const normalized = normalizeRussianPhone(input.phone)
  if (!normalized) {
    throw new StreamTelecomError('Not correct phone')
  }
  const phoneDigits = phoneToStreamTelecomDigits(normalized)

  if (env.flashcallTestMode && env.nodeEnv === 'test') {
    return { code: String(input.code) }
  }

  const body = new URLSearchParams({
    login: env.streamTelecomLogin,
    pass: env.streamTelecomPass,
    type: 'flash',
    phone: phoneDigits,
    code: String(input.code),
    capacity: '4',
  })

  if (env.streamTelecomCallbackUrl) {
    body.set('callback_url', env.streamTelecomCallbackUrl)
  }

  const response = await fetch(resolveFlashEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
  })

  const text = await response.text()
  let parsed: StreamTelecomResponse
  try {
    parsed = JSON.parse(text) as StreamTelecomResponse
  } catch {
    throw new StreamTelecomError('System Failed')
  }

  if (parsed.result !== 'Success') {
    throw new StreamTelecomError(parsed.message?.trim() || 'System Failed')
  }

  return { code: parsed.code ?? String(input.code) }
}

export const sendSms = async (input: {
  phone: string
  text: string
}): Promise<{ id: string }> => {
  if (!env.flashcallConfigured) {
    throw new StreamTelecomError('SMS provider is not configured')
  }

  const normalized = normalizeRussianPhone(input.phone)
  if (!normalized) {
    throw new StreamTelecomError('Not correct phone')
  }
  const phoneDigits = phoneToStreamTelecomDigits(normalized)

  if (env.nodeEnv === 'test') {
    return { id: 'test-sms-id' }
  }

  const params = new URLSearchParams({
    user: env.streamTelecomLogin,
    pwd: env.streamTelecomPass,
    sadr: env.streamTelecomSmsSender,
    dadr: phoneDigits,
    text: input.text,
  })

  if (env.streamTelecomCallbackUrl) {
    params.set('callback_url', env.streamTelecomCallbackUrl)
  }

  const response = await fetch(`${SMS_ENDPOINT}?${params.toString()}`, { method: 'GET' })
  const body = (await response.text()).trim()

  if (!SMS_SUCCESS_ID_PATTERN.test(body)) {
    throw new StreamTelecomError(body || 'System Failed')
  }

  return { id: body.split(',')[0]! }
}
