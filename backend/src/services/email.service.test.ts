import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerify = vi.fn()
const mockSendMail = vi.fn()
const mockCreateTransport = vi.fn(() => ({
  sendMail: mockSendMail,
  verify: mockVerify,
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (...args: unknown[]) => mockCreateTransport(...args),
  },
}))

const envState = {
  customerAccountsEnabled: true,
  smtpHost: '',
  smtpUser: '',
  smtpPass: '',
  smtpPort: 0,
  storefrontPublicUrl: 'http://localhost:3000',
}

vi.mock('../utils/env', () => ({
  env: envState,
}))

describe('email.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    envState.customerAccountsEnabled = true
    envState.smtpHost = ''
    envState.smtpUser = ''
    envState.smtpPass = ''
    envState.smtpPort = 0
  })

  it('throws when SMTP missing and customer accounts enabled', async () => {
    const { sendEmail, EmailNotConfiguredError } = await import('./email.service')
    await expect(
      sendEmail({ to: 'a@b.com', subject: 't', html: '<p>x</p>' }),
    ).rejects.toBeInstanceOf(EmailNotConfiguredError)
  })

  it('verifySmtpTransport throws when SMTP missing and ЛК enabled', async () => {
    const { verifySmtpTransport, EmailNotConfiguredError } = await import('./email.service')
    await expect(verifySmtpTransport()).rejects.toBeInstanceOf(EmailNotConfiguredError)
  })

  it('verifySmtpTransport resolves when transporter.verify succeeds', async () => {
    envState.smtpHost = 'smtp.example.com'
    envState.smtpUser = 'u'
    envState.smtpPass = 'p'
    mockVerify.mockResolvedValueOnce(true)

    const { verifySmtpTransport } = await import('./email.service')
    await expect(verifySmtpTransport()).resolves.toBeUndefined()
    expect(mockVerify).toHaveBeenCalled()
  })

  it('verifySmtpTransport rejects when transporter.verify fails', async () => {
    envState.smtpHost = 'smtp.example.com'
    envState.smtpUser = 'u'
    envState.smtpPass = 'p'
    mockVerify.mockRejectedValueOnce(new Error('auth failed'))

    const { verifySmtpTransport, EmailSendError } = await import('./email.service')
    await expect(verifySmtpTransport()).rejects.toBeInstanceOf(EmailSendError)
  })

  it('verifySmtpTransport no-ops when ЛК disabled', async () => {
    envState.customerAccountsEnabled = false
    const { verifySmtpTransport } = await import('./email.service')
    await expect(verifySmtpTransport()).resolves.toBeUndefined()
    expect(mockCreateTransport).not.toHaveBeenCalled()
  })

  it('buildAlreadyRegisteredEmailHtml links to login and forgot password', async () => {
    const { buildAlreadyRegisteredEmailHtml } = await import('./email.service')
    const html = buildAlreadyRegisteredEmailHtml()
    expect(html).toContain('http://localhost:3000/login/')
    expect(html).toContain('http://localhost:3000/password/forgot/')
    expect(html).toContain('уже зарегистрирован')
  })

  it('handleSmtpStartupVerifyFailure logs and does not exit', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { handleSmtpStartupVerifyFailure } = await import('./email.service')
    handleSmtpStartupVerifyFailure(new Error('SMTP down'))
    expect(exitSpy).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalled()
    exitSpy.mockRestore()
    errSpy.mockRestore()
  })
})
