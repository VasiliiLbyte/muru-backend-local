import nodemailer from 'nodemailer'

import { env } from '../utils/env'

export class EmailNotConfiguredError extends Error {
  constructor(message = 'SMTP is not configured') {
    super(message)
    this.name = 'EmailNotConfiguredError'
  }
}

export class EmailSendError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'EmailSendError'
    if (cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = cause
    }
  }
}

const createTransport = () => {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    return null
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort || 587,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  })
}

export const sendEmail = async (options: {
  to: string
  subject: string
  html: string
}): Promise<void> => {
  const transport = createTransport()

  if (!transport) {
    if (env.customerAccountsEnabled) {
      throw new EmailNotConfiguredError(
        'SMTP is required when customer accounts (CUSTOMER_JWT_SECRET) are enabled',
      )
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[email] SMTP not configured, logging instead:')
      console.log('[email] TO:', options.to)
      console.log('[email] SUBJECT:', options.subject)
    }
    return
  }

  try {
    await transport.sendMail({
      from: `"MURU Home Design" <${env.smtpUser}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
  } catch (error) {
    console.error('[email] sendMail failed:', error)
    throw new EmailSendError('Failed to send email', error)
  }
}

export const buildVerifyEmailHtml = (token: string): string => {
  const url = `${env.storefrontPublicUrl}/verify?token=${encodeURIComponent(token)}`
  return `<p>Здравствуйте!</p>
<p>Подтвердите email для аккаунта MURU:</p>
<p><a href="${url}">${url}</a></p>
<p>Ссылка действует 60 минут.</p>`
}

export const buildPasswordResetEmailHtml = (token: string): string => {
  const url = `${env.storefrontPublicUrl}/password/reset?token=${encodeURIComponent(token)}`
  return `<p>Здравствуйте!</p>
<p>Сброс пароля аккаунта MURU:</p>
<p><a href="${url}">${url}</a></p>
<p>Ссылка действует 60 минут. Если вы не запрашивали сброс — проигнорируйте письмо.</p>`
}

export const sendVerifyEmail = async (to: string, token: string): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Подтверждение email — MURU',
    html: buildVerifyEmailHtml(token),
  })
}

export const sendPasswordResetEmail = async (to: string, token: string): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Сброс пароля — MURU',
    html: buildPasswordResetEmailHtml(token),
  })
}

/**
 * Startup SMTP health check when customer accounts (ЛК) are enabled.
 * Throws if credentials missing or transporter.verify() fails.
 */
export const verifySmtpTransport = async (): Promise<void> => {
  if (!env.customerAccountsEnabled) {
    return
  }

  const transport = createTransport()
  if (!transport) {
    throw new EmailNotConfiguredError(
      'SMTP is required when customer accounts (CUSTOMER_JWT_SECRET) are enabled',
    )
  }

  try {
    await transport.verify()
  } catch (error) {
    console.error('[email] SMTP verify failed:', error)
    throw new EmailSendError('SMTP transport verification failed', error)
  }
}
