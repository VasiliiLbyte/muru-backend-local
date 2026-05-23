import { Router } from 'express'

import { getLqip, serveImage } from '../services/image-proxy.service'
import { isValidDriveFileId, parseImageVariant } from '../utils/drive-file-id'

export const imageRouter = Router()

imageRouter.get('/img/:fileId/lqip', async (req, res) => {
  const fileId = req.params.fileId
  if (!isValidDriveFileId(fileId)) {
    res.status(400).type('text/plain').send('Invalid file id')
    return
  }

  try {
    const data = await getLqip(fileId)
    res.json(data)
  } catch (error) {
    console.error('[image-proxy] lqip error', error)
    res.status(502).type('text/plain').send('Failed to load placeholder')
  }
})

imageRouter.get('/img/:fileId/:width.:format', async (req, res) => {
  const fileId = req.params.fileId
  if (!isValidDriveFileId(fileId)) {
    res.status(400).type('text/plain').send('Invalid file id')
    return
  }

  const variant = parseImageVariant(req.params.width, req.params.format)
  if (!variant) {
    res.status(400).type('text/plain').send('Invalid width or format')
    return
  }

  try {
    const result = await serveImage(fileId, variant.width, variant.format)
    res.setHeader('Content-Type', result.mimeType)
    res.setHeader('Cache-Control', result.cacheControl)
    result.stream.on('error', (err) => {
      console.error('[image-proxy] stream error', err)
      if (!res.headersSent) {
        res.status(502).type('text/plain').send('Failed to read cached image')
      } else {
        res.destroy()
      }
    })
    result.stream.pipe(res)
  } catch (error) {
    const status = (error as { code?: number }).code === 404 ? 404 : 502
    console.error('[image-proxy] serve error', error)
    res.status(status).type('text/plain').send(status === 404 ? 'Not found' : 'Failed to process image')
  }
})
