import { existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'

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
  ADMIN_JWT_SECRET: z.string().optional(),
  DEV_TELEGRAM_USER_ID: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  ADMIN_TELEGRAM_IDS: z.string().default(''),
  ORDER_NOTIFY_TELEGRAM_IDS: z.string().default(''),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_PROVIDER_TOKEN: z.string().optional(),
  TELEGRAM_MINI_APP_URL: z.string().optional(),
  BOT_WELCOME_DESCRIPTION: z.string().optional(),
  BOT_WELCOME_MESSAGE: z.string().optional(),
  BOT_SITE_URL: z.string().optional(),
  BOT_CHANNEL_URL: z.string().optional(),
  BOT_CARE_URL: z.string().optional(),
  BOT_DELIVERY_URL: z.string().optional(),
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
  UPLOADS_DIR: z.string().optional(),
  CDEK_ENV: z.enum(['test', 'production']).default('test'),
  CDEK_CLIENT_ID: z.string().optional(),
  CDEK_CLIENT_SECRET: z.string().optional(),
  CDEK_SENDER_CITY_CODE: z.string().default('137'),
  CDEK_SENDER_POSTAL_CODE: z.string().default('192102'),
  CDEK_SENDER_ADDRESS: z
    .string()
    .default('г. Санкт-Петербург, ул. Дубровская, 13 (цокольный этаж, отдельный вход со двора)'),
  CDEK_SENDER_NAME: z.string().optional(),
  CDEK_SENDER_PHONE: z.string().optional(),
  CDEK_TARIFF_DOOR: z.string().default('139'),
  CDEK_TARIFF_PVZ: z.string().default('138'),
  CDEK_WEBHOOK_SECRET: z.string().optional(),
  DADATA_API_KEY: z.string().optional(),
  DADATA_SECRET_KEY: z.string().optional(),
  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),
  YOOKASSA_WEB_SHOP_ID: z.string().optional(),
  YOOKASSA_WEB_SECRET_KEY: z.string().optional(),
  YOOKASSA_RETURN_URL: z.string().optional(),
  YOOKASSA_WEB_RETURN_URL: z.string().optional(),
  YOOKASSA_VAT_CODE: z.string().optional(),
  YOOKASSA_VERIFY_IP: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => issue.message).join('; ')
  throw new Error(`Invalid environment: ${details}`)
}

if (parsed.data.CDEK_ENV === 'production') {
  const cdekClientId = parsed.data.CDEK_CLIENT_ID?.trim()
  const cdekClientSecret = parsed.data.CDEK_CLIENT_SECRET?.trim()
  if (!cdekClientId || !cdekClientSecret) {
    console.error('[env] CDEK_ENV=production requires CDEK_CLIENT_ID and CDEK_CLIENT_SECRET')
    process.exit(1)
  }
}

const yookassaShopId = parsed.data.YOOKASSA_SHOP_ID?.trim() ?? ''
const yookassaSecretKey = parsed.data.YOOKASSA_SECRET_KEY?.trim() ?? ''
const yookassaWebShopId = parsed.data.YOOKASSA_WEB_SHOP_ID?.trim() ?? ''
const yookassaWebSecretKey = parsed.data.YOOKASSA_WEB_SECRET_KEY?.trim() ?? ''
const yookassaReturnUrl = parsed.data.YOOKASSA_RETURN_URL?.trim() ?? ''
const yookassaWebReturnUrl = parsed.data.YOOKASSA_WEB_RETURN_URL?.trim() ?? ''
const yookassaVatCode = Number.parseInt(parsed.data.YOOKASSA_VAT_CODE?.trim() || '1', 10)
const yookassaVerifyIp = parsed.data.YOOKASSA_VERIFY_IP?.trim().toLowerCase() !== 'false'
const yookassaEnabled = Boolean(yookassaShopId && yookassaSecretKey)

const telegramBotToken = parsed.data.TELEGRAM_BOT_TOKEN?.trim() ?? ''
const telegramProviderToken = parsed.data.TELEGRAM_PROVIDER_TOKEN?.trim() ?? ''
const nativePaymentsEnabled = Boolean(telegramBotToken && telegramProviderToken)

const nodeEnvForYookassa = parsed.data.NODE_ENV || 'development'
if (nodeEnvForYookassa === 'production') {
  if (!yookassaShopId || !yookassaSecretKey) {
    console.error('[env] production requires YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY')
    process.exit(1)
  }
  if (!yookassaReturnUrl) {
    console.error('[env] production requires YOOKASSA_RETURN_URL when YooKassa is configured')
    process.exit(1)
  }
  const adminJwtSecret = parsed.data.ADMIN_JWT_SECRET?.trim() ?? ''
  if (adminJwtSecret.length < 32) {
    console.error('[env] production requires ADMIN_JWT_SECRET (>=32 chars)')
    process.exit(1)
  }
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

const DEFAULT_BOT_WELCOME_DESCRIPTION = 'Добро пожаловать в магазин интерьерного декора MURU'

const DEFAULT_BOT_WELCOME_MESSAGE = `Добро пожаловать в MURU

В мире, где слишком много шума, мы создаём дом, который звучит как уют и спокойствие. MURU - это тишина, ставшая формой.`

const nodeEnv = parsed.data.NODE_ENV || 'development'
const defaultImageCacheDir =
  nodeEnv === 'production'
    ? '/var/www/muru/cache/img'
    : resolve(process.cwd(), 'cache', 'img')

const defaultUploadsDir =
  nodeEnv === 'production'
    ? '/var/www/muru/uploads'
    : resolve(process.cwd(), basename(process.cwd()) === 'backend' ? '../uploads' : 'uploads')

export const env = {
  nodeEnv,
  imageCacheDir: parsed.data.IMAGE_CACHE_DIR?.trim() || defaultImageCacheDir,
  uploadsDir: resolve(parsed.data.UPLOADS_DIR?.trim() || defaultUploadsDir),
  port: Number(parsed.data.PORT || 4000),
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  adminJwtSecret: parsed.data.ADMIN_JWT_SECRET?.trim() ?? '',
  devTelegramUserId: parsed.data.DEV_TELEGRAM_USER_ID ?? '',
  allowedOrigins,
  adminTelegramIds,
  orderNotifyTelegramIds,
  telegramBotToken,
  telegramProviderToken,
  telegramMiniAppUrl: parsed.data.TELEGRAM_MINI_APP_URL ?? '',
  botWelcomeDescription:
    parsed.data.BOT_WELCOME_DESCRIPTION?.trim() || DEFAULT_BOT_WELCOME_DESCRIPTION,
  botWelcomeMessage: parsed.data.BOT_WELCOME_MESSAGE?.trim() || DEFAULT_BOT_WELCOME_MESSAGE,
  botSiteUrl: parsed.data.BOT_SITE_URL?.trim() || 'https://muru.ru',
  botChannelUrl: parsed.data.BOT_CHANNEL_URL?.trim() || 'https://t.me/muru_online',
  botCareUrl: parsed.data.BOT_CARE_URL?.trim() ?? '',
  botDeliveryUrl: parsed.data.BOT_DELIVERY_URL?.trim() ?? '',
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
  cdek: {
    env: parsed.data.CDEK_ENV === 'production' ? ('production' as const) : ('test' as const),
    clientId: parsed.data.CDEK_CLIENT_ID?.trim() ?? '',
    clientSecret: parsed.data.CDEK_CLIENT_SECRET?.trim() ?? '',
    senderCityCode: Number(parsed.data.CDEK_SENDER_CITY_CODE) || 137,
    senderPostalCode: parsed.data.CDEK_SENDER_POSTAL_CODE?.trim() ?? '',
    senderAddress: parsed.data.CDEK_SENDER_ADDRESS?.trim() ?? '',
    senderName: parsed.data.CDEK_SENDER_NAME?.trim() ?? '',
    senderPhone: parsed.data.CDEK_SENDER_PHONE?.trim() ?? '',
    tariffDoor: Number(parsed.data.CDEK_TARIFF_DOOR) || 139,
    tariffPvz: Number(parsed.data.CDEK_TARIFF_PVZ) || 138,
    webhookSecret: parsed.data.CDEK_WEBHOOK_SECRET?.trim() ?? '',
  },
  dadata: {
    apiKey: parsed.data.DADATA_API_KEY?.trim() ?? '',
    secretKey: parsed.data.DADATA_SECRET_KEY?.trim() ?? '',
  },
  yookassa: {
    shopId: yookassaShopId,
    secretKey: yookassaSecretKey,
    webShopId: yookassaWebShopId,
    webSecretKey: yookassaWebSecretKey,
    returnUrl: yookassaReturnUrl,
    webReturnUrl: yookassaWebReturnUrl,
    vatCode: Number.isFinite(yookassaVatCode) ? yookassaVatCode : 1,
    enabled: yookassaEnabled,
    verifyIp: yookassaVerifyIp,
  },
  payments: {
    nativeEnabled: nativePaymentsEnabled,
  },
}
