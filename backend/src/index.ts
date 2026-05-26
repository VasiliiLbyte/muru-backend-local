import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import { adminRouter } from './routes/admin'
import { imageRouter } from './routes/images'
import { authRouter } from './routes/auth.routes'
import { cdekRouter } from './routes/cdek.routes'
import { catalogRouter } from './routes/catalog.routes'
import { favoritesRouter } from './routes/favorites.routes'
import { ordersRouter } from './routes/orders.routes'
import { profileRouter } from './routes/profile.routes'
import { errorHandler } from './middleware/error-handler.middleware'
import { startTelegramBotPolling } from './services/telegram-bot.service'
import { fail, ok } from './utils/api-response'
import { env } from './utils/env'

dotenv.config()

const app = express()
const port = env.port
const ALLOWED_ORIGINS = [
  'https://muru-blue.vercel.app',
  'https://*.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  ...env.allowedOrigins,
]

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const isAllowed = ALLOWED_ORIGINS.some((pattern) => {
        if (pattern.includes('*')) {
          const regex = new RegExp(`^${pattern.replace('*', '.*')}$`)
          return regex.test(origin)
        }
        return pattern === origin
      })
      if (isAllowed) return callback(null, true)
      return callback(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
  }),
)
app.use(express.json())
app.use(imageRouter)
app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/catalog', catalogRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/orders', ordersRouter)
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
