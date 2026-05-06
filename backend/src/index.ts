import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import { adminRouter } from './routes/admin'
import { authRouter } from './routes/auth.routes'
import { catalogRouter } from './routes/catalog.routes'
import { favoritesRouter } from './routes/favorites.routes'
import { ordersRouter } from './routes/orders.routes'
import { profileRouter } from './routes/profile.routes'
import { startTelegramBotPolling } from './services/telegram-bot.service'
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
app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/catalog', catalogRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/profile', profileRouter)

app.get('/api/health', async (_req, res) => {
  try {
    const { pool } = await import('./utils/db')
    const result = await pool.query('SELECT 1 AS ok')
    res.json({
      success: true,
      data: {
        service: 'muru-backend',
        status: 'ok',
        db: result.rows[0]?.ok === 1 ? 'connected' : 'error',
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    res.status(503).json({
      success: false,
      data: { service: 'muru-backend', status: 'error', db: 'disconnected' },
      error: error instanceof Error ? error.message : 'Unknown',
    })
  }
})

app.listen(port, () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[muru-backend] Listening on port ${port}`)
  }
  startTelegramBotPolling()
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
