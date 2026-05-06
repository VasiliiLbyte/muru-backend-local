import { z } from 'zod'

const envSchema = z.object({
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ADMIN_TELEGRAM_IDS: z.string().default(''),
  ORDER_NOTIFY_TELEGRAM_IDS: z.string().default(''),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  ORDER_NOTIFY_EMAIL: z.string().email().default('Muru_online@mail.ru'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email('GOOGLE_SERVICE_ACCOUNT_EMAIL must be valid'),
  GOOGLE_PRIVATE_KEY: z.string().min(1, 'GOOGLE_PRIVATE_KEY is required'),
  GOOGLE_SHEET_ID: z.string().default('13R05JyBIJsMl0fE7qQRxG1nVcKTU3XFg'),
  GOOGLE_DRIVE_FOLDER_ID: z.string().min(1, 'GOOGLE_DRIVE_FOLDER_ID is required'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => issue.message).join('; ')
  throw new Error(`Invalid environment: ${details}`)
}

const rawAdminIds = parsed.data.ADMIN_TELEGRAM_IDS
const adminTelegramIds = rawAdminIds
  .split(',')
  .map((item) => Number(item.trim()))
  .filter((value) => Number.isInteger(value))

const orderNotifyTelegramIds = parsed.data.ORDER_NOTIFY_TELEGRAM_IDS
  .split(',')
  .map((item) => Number(item.trim()))
  .filter((value) => Number.isInteger(value))

export const env = {
  port: Number(parsed.data.PORT || 4000),
  databaseUrl: parsed.data.DATABASE_URL,
  adminTelegramIds,
  orderNotifyTelegramIds,
  telegramBotToken: parsed.data.TELEGRAM_BOT_TOKEN ?? '',
  orderNotifyEmail: parsed.data.ORDER_NOTIFY_EMAIL,
  smtpHost: parsed.data.SMTP_HOST ?? '',
  smtpPort: Number(parsed.data.SMTP_PORT || 0),
  smtpUser: parsed.data.SMTP_USER ?? '',
  smtpPass: parsed.data.SMTP_PASS ?? '',
  googleServiceAccountEmail: parsed.data.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  googlePrivateKey: parsed.data.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  googleSheetId: parsed.data.GOOGLE_SHEET_ID,
  googleDriveFolderId: parsed.data.GOOGLE_DRIVE_FOLDER_ID,
}
