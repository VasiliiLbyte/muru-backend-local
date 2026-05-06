import nodemailer from 'nodemailer'

import { env } from '../utils/env'

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
    if (process.env.NODE_ENV !== 'production') {
      console.log('[email] SMTP not configured, logging instead:')
      console.log('[email] TO:', options.to)
      console.log('[email] SUBJECT:', options.subject)
    }
    return
  }

  await transport.sendMail({
    from: `"MURU Home Design" <${env.smtpUser}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  })
}
