import { pool } from '../../utils/db'
import { cdekFetch, CdekApiError } from './client'

const log = console

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000]

type CdekOrderGet = {
  entity?: {
    uuid?: string
    cdek_number?: string
    statuses?: Array<{ code?: string; name?: string; date_time?: string }>
  }
}

export const fetchAndStoreTrackNumber = async (orderId: number, uuid: string): Promise<boolean> => {
  try {
    const resp = await cdekFetch<CdekOrderGet>(`/orders/${uuid}`, { method: 'GET' })
    const trackNumber = resp.entity?.cdek_number ?? null
    const statuses = resp.entity?.statuses ?? []
    const last = statuses.length > 0 ? statuses[statuses.length - 1] : null

    if (trackNumber) {
      const updated = await pool.query<{ id: number }>(
        `UPDATE orders
           SET cdek_track_number = $2,
               cdek_status = COALESCE($3, cdek_status),
               cdek_status_updated_at = NOW()
         WHERE id = $1 AND cdek_track_number IS NULL
         RETURNING id`,
        [orderId, trackNumber, last?.code ?? null],
      )
      if (updated.rowCount === 0) return true

      log.log('[cdek-poll] track saved', { orderId, trackNumber })

      const owner = await pool.query<{ telegram_user_id: string }>(
        `SELECT telegram_user_id FROM orders WHERE id = $1`,
        [orderId],
      )
      const chatId = owner.rows[0]?.telegram_user_id
      if (chatId) {
        const { callTelegramApi } = await import('../telegram-http.service')
        await Promise.resolve(
          callTelegramApi('sendMessage', {
            chat_id: Number(chatId),
            parse_mode: 'HTML',
            text: [
              `📦 <b>Заказ #${orderId}</b>`,
              `Ваш трек-номер СДЭК: <code>${trackNumber}</code>`,
              `Отследить: https://www.cdek.ru/ru/tracking?order_id=${trackNumber}`,
            ].join('\n'),
          }),
        ).catch(() => undefined)
      }
      return true
    }
    return false
  } catch (e) {
    if (e instanceof CdekApiError && e.status === 404) {
      return false
    }
    log.warn('[cdek-poll] error', { orderId, e })
    return false
  }
}

export const pollTrackNumberNow = async (orderId: number, uuid: string): Promise<boolean> =>
  fetchAndStoreTrackNumber(orderId, uuid)

export const schedulePullTrackNumber = (orderId: number, uuid: string): void => {
  let attempt = 0
  const tick = async () => {
    const got = await fetchAndStoreTrackNumber(orderId, uuid)
    if (got) return
    attempt += 1
    if (attempt >= RETRY_DELAYS_MS.length) return
    setTimeout(() => {
      void tick()
    }, RETRY_DELAYS_MS[attempt])
  }
  setTimeout(() => {
    void tick()
  }, RETRY_DELAYS_MS[0])
}

export const recoverPendingCdekTracks = async (): Promise<void> => {
  const res = await pool.query<{ id: number; cdek_uuid: string }>(
    `SELECT id, cdek_uuid FROM orders
     WHERE cdek_sync_state = 'created'
       AND cdek_uuid IS NOT NULL
       AND cdek_track_number IS NULL
       AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY created_at DESC
     LIMIT 50`,
  )
  for (const row of res.rows) {
    schedulePullTrackNumber(row.id, row.cdek_uuid)
  }
}
