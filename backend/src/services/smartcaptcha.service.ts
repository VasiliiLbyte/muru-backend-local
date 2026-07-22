import { env } from '../utils/env'

export class CaptchaRejectedError extends Error {
  constructor(message = 'Captcha verification failed') {
    super(message)
    this.name = 'CaptchaRejectedError'
  }
}

type SmartCaptchaValidateResponse = {
  status?: string
  message?: string
}

/**
 * Server-side Yandex SmartCaptcha check.
 * In non-production, SMARTCAPTCHA_DEV_BYPASS=true skips remote validation.
 * Production never bypasses.
 */
export const verifySmartCaptcha = async (
  token: string | undefined | null,
  clientIp?: string,
): Promise<void> => {
  if (env.smartCaptchaDevBypass) {
    return
  }

  const trimmed = typeof token === 'string' ? token.trim() : ''
  if (!trimmed) {
    throw new CaptchaRejectedError('Captcha token is required')
  }

  if (!env.smartCaptchaServerKey) {
    if (env.nodeEnv === 'production') {
      throw new CaptchaRejectedError('Captcha is not configured')
    }
    // Non-prod without key and without explicit bypass: reject (force bypass flag or key)
    throw new CaptchaRejectedError(
      'Captcha is not configured (set SMARTCAPTCHA_SERVER_KEY or SMARTCAPTCHA_DEV_BYPASS=true)',
    )
  }

  const body = new URLSearchParams({
    secret: env.smartCaptchaServerKey,
    token: trimmed,
  })
  if (clientIp) {
    body.set('ip', clientIp)
  }

  const response = await fetch('https://smartcaptcha.yandexcloud.net/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new CaptchaRejectedError('Captcha upstream error')
  }

  const data = (await response.json()) as SmartCaptchaValidateResponse
  if (data.status !== 'ok') {
    throw new CaptchaRejectedError(data.message || 'Captcha verification failed')
  }
}
