import { z } from 'zod'

const envSchema = z.object({
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ADMIN_TELEGRAM_IDS: z.string().default(''),
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

export const env = {
  port: Number(parsed.data.PORT || 4000),
  databaseUrl: parsed.data.DATABASE_URL,
  adminTelegramIds,
  googleServiceAccountEmail: parsed.data.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  googlePrivateKey: parsed.data.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  googleSheetId: parsed.data.GOOGLE_SHEET_ID,
  googleDriveFolderId: parsed.data.GOOGLE_DRIVE_FOLDER_ID,
}
