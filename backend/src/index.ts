import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import { adminRouter } from './routes/admin'
import { catalogRouter } from './routes/catalog.routes'
import { ordersRouter } from './routes/orders.routes'
import { env } from './utils/env'

dotenv.config()

const app = express()
const port = env.port

app.use(cors())
app.use(express.json())
app.use('/api/admin', adminRouter)
app.use('/api/catalog', catalogRouter)
app.use('/api/orders', ordersRouter)

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'muru-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  })
})

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`)
})
