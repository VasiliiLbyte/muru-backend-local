import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import dotenv from 'dotenv'
import { z } from 'zod'

const envCandidatePaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../.env'),
  resolve(process.cwd(), '.cursor/.env'),
  resolve(process.cwd(), '../.cursor/.env'),
]

const resolvedEnvPath = envCandidatePaths.find((filePath) => existsSync(filePath))

if (resolvedEnvPath) {
  dotenv.config({ path: resolvedEnvPath })
}

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  DEV_TELEGRAM_USER_ID: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  ADMIN_TELEGRAM_IDS: z.string().default(''),
  ORDER_NOTIFY_TELEGRAM_IDS: z.string().default(''),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_MINI_APP_URL: z.string().optional(),
  ORDER_NOTIFY_EMAIL: z.union([z.string().email(), z.literal('')]).default('Muru_online@mail.ru'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email('GOOGLE_SERVICE_ACCOUNT_EMAIL must be valid'),
  GOOGLE_PRIVATE_KEY: z.string().min(1, 'GOOGLE_PRIVATE_KEY is required'),
  CATALOG_SOURCE: z.enum(['xlsx', 'sheets']).optional(),
  GOOGLE_CATALOG_FILE_ID: z.string().optional(),
  GOOGLE_CATALOG_XLSX_SHEET_NAME: z.string().optional(),
  ENABLE_SHEETS_STOCK_WRITE: z.string().optional(),
  GOOGLE_SHEET_ID: z.string().default('13oevOsZad_qZ6K8LvCy0Xa-MnALX1dBChS9jMajvaWo'),
  GOOGLE_DRIVE_FOLDER_ID: z.string().min(1, 'GOOGLE_DRIVE_FOLDER_ID is required'),
  IMAGE_CACHE_DIR: z.string().optional(),
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

const allowedOrigins = (parsed.data.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const catalogSource = parsed.data.CATALOG_SOURCE === 'sheets' ? 'sheets' : 'xlsx'

const enableSheetsStockWrite =
  parsed.data.ENABLE_SHEETS_STOCK_WRITE === 'true'
    ? true
    : parsed.data.ENABLE_SHEETS_STOCK_WRITE === 'false'
      ? false
      : catalogSource === 'sheets'

const nodeEnv = parsed.data.NODE_ENV || 'development'
const defaultImageCacheDir =
  nodeEnv === 'production'
    ? '/var/www/muru/cache/img'
    : resolve(process.cwd(), 'cache', 'img')

export const env = {
  nodeEnv,
  imageCacheDir: parsed.data.IMAGE_CACHE_DIR?.trim() || defaultImageCacheDir,
  port: Number(parsed.data.PORT || 4000),
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  devTelegramUserId: parsed.data.DEV_TELEGRAM_USER_ID ?? '',
  allowedOrigins,
  adminTelegramIds,
  orderNotifyTelegramIds,
  telegramBotToken: parsed.data.TELEGRAM_BOT_TOKEN ?? '',
  telegramMiniAppUrl: parsed.data.TELEGRAM_MINI_APP_URL ?? '',
  orderNotifyEmail: parsed.data.ORDER_NOTIFY_EMAIL || 'Muru_online@mail.ru',
  smtpHost: parsed.data.SMTP_HOST ?? '',
  smtpPort: Number(parsed.data.SMTP_PORT || 0),
  smtpUser: parsed.data.SMTP_USER ?? '',
  smtpPass: parsed.data.SMTP_PASS ?? '',
  googleServiceAccountEmail: parsed.data.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  googlePrivateKey: parsed.data.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  catalogSource,
  googleCatalogFileId:
    parsed.data.GOOGLE_CATALOG_FILE_ID?.trim() || '13R05JyBIJsMl0fE7qQRxG1nVcKTU3XFg',
  googleCatalogXlsxSheetName: parsed.data.GOOGLE_CATALOG_XLSX_SHEET_NAME?.trim() || '',
  enableSheetsStockWrite,
  googleSheetId: parsed.data.GOOGLE_SHEET_ID,
  googleDriveFolderId: parsed.data.GOOGLE_DRIVE_FOLDER_ID,
}
