export type SyncApiResult = {
  totalRows: number
  syncedProducts: number
  skippedProducts: number
  errors: Array<{ sku: string; reason: string }>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export const triggerCatalogSync = async (telegramUserId: number): Promise<SyncApiResult> => {
  const response = await fetch(`${API_BASE_URL}/api/admin/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-user-id': String(telegramUserId),
    },
    body: JSON.stringify({ telegramUserId }),
  })

  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Sync request failed')
  }

  return payload.data as SyncApiResult
}
