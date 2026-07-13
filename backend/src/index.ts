import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import cookieParser from 'cookie-parser'

import { adminRouter } from './routes/admin'
import { adminAuthRouter } from './routes/admin-auth.routes'
import { imageRouter } from './routes/images'
import { authRouter } from './routes/auth.routes'
import { cdekRouter } from './routes/cdek.routes'
import { catalogRouter } from './routes/catalog.routes'
import { contentCrmRouter } from './routes/content-crm.routes'
import { crmCatalogRouter } from './routes/crm-catalog.routes'
import { crmOrdersRouter } from './routes/crm-orders.routes'
import { contentPublicRouter } from './routes/content-public.routes'
import { favoritesRouter } from './routes/favorites.routes'
import { ordersRouter } from './routes/orders.routes'
import { paymentsRouter } from './routes/payments.routes'
import { profileRouter } from './routes/profile.routes'
import { yookassaWebhookRouter } from './routes/yookassa-webhook.routes'
import { errorHandler } from './middleware/error-handler.middleware'
import { startTelegramBotPolling } from './services/telegram-bot.service'
import { fail, ok } from './utils/api-response'
import { env } from './utils/env'

dotenv.config()

const app = express()
app.set('trust proxy', 1)
const port = env.port
const isProd = env.nodeEnv === 'production'

// Точный allowlist. Никаких wildcard (например https://*.vercel.app): иначе любой
// проект на *.vercel.app смог бы дёргать API с credentials. Новые домены добавляются
// через переменную окружения ALLOWED_ORIGINS (точные origin'ы через запятую).
const PRODUCTION_ORIGINS = [
  'https://murushop.ru',
  'https://web.murushop.ru',
  'https://www.murushop.ru',
  'https://murushop.online',
  'https://www.murushop.online',
  'https://muru-blue.vercel.app',
]

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000']

const ALLOWED_ORIGINS = Array.from(
  new Set([
    ...PRODUCTION_ORIGINS,
    ...(isProd ? [] : DEV_ORIGINS),
    ...env.allowedOrigins,
  ]),
)

app.use(express.json())
app.use('/yookassa-webhook', yookassaWebhookRouter)
app.use(cookieParser())

app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin / server-to-server / Telegram webview часто шлют запрос без Origin — пропускаем.
      if (!origin) return callback(null, true)
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
      if (!isProd) console.warn(`[cors] blocked origin: ${origin}`)
      // Не бросаем ошибку (иначе уходит в error-handler как 500 и шумит в логах) —
      // просто не выставляем CORS-заголовки, браузер сам заблокирует ответ.
      return callback(null, false)
    },
    credentials: true,
  }),
)
app.use(imageRouter)
app.use('/api/auth', authRouter)
app.use('/api/admin-auth', adminAuthRouter)
app.use('/api/crm/content', contentCrmRouter)
app.use('/api/crm/orders', crmOrdersRouter)
app.use('/api/crm/catalog', crmCatalogRouter)
app.use('/api/content', contentPublicRouter)
app.use('/api/admin', adminRouter)
app.use('/api/catalog', catalogRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/profile', profileRouter)
app.use('/api/cdek', cdekRouter)

app.get('/api/health', async (_req, res, next) => {
  try {
    const { pool } = await import('./utils/db')
    const result = await pool.query('SELECT 1 AS ok')
    const dbOk = result.rows[0]?.ok === 1
    if (!dbOk) {
      return fail(res, 503, 'Database connection error', 'UPSTREAM')
    }
    return ok(res, {
      service: 'muru-backend',
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

app.use(errorHandler)

app.listen(port, () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[muru-backend] Listening on port ${port}`)
  }
  startTelegramBotPolling()

  if (process.env.NODE_ENV !== 'test' && env.cdek.clientId && env.cdek.clientSecret) {
    setTimeout(() => {
      void import('./services/cdek/track-poll.service')
        .then((m) => m.recoverPendingCdekTracks())
        .catch((e) => console.warn('[cdek-poll] recover failed', e))
    }, 30_000)
  }

  if (process.env.NODE_ENV !== 'test' && env.yookassa.enabled) {
    const runExpiry = () => {
      void import('./services/yookassa/payment-expiry.service')
        .then((m) => m.cancelStalePayments())
        .catch((e) => console.warn('[yk-expiry] tick failed', e))
    }
    setTimeout(runExpiry, 60_000)
    setInterval(runExpiry, 60 * 60 * 1000)
  }

  if (process.env.NODE_ENV !== 'test') {
    const runSyncScheduler = () => {
      void import('./services/sync-scheduler')
        .then((m) => m.runSyncSchedulerTick())
        .catch((e) => console.error('[sync-scheduler] tick import failed', e))
    }
    setTimeout(runSyncScheduler, 60_000)
    setInterval(runSyncScheduler, 10 * 60 * 1000)
  }
})

process.on('SIGTERM', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[server] SIGTERM received, shutting down gracefully')
  }
  process.exit(0)
})

process.on('SIGINT', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[server] SIGINT received, shutting down gracefully')
  }
  process.exit(0)
})
