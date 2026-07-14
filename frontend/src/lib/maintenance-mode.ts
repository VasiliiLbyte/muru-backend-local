let active = false
const listeners = new Set<() => void>()

export const isMaintenanceMode = (): boolean => active

export const setMaintenanceMode = (value: boolean): void => {
  if (active === value) return
  active = value
  listeners.forEach((listener) => listener())
}

export const subscribeMaintenanceMode = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const isMaintenanceApiResponse = (
  status: number,
  payload: unknown,
): payload is { ok: false; code: 'MAINTENANCE'; message: string } => {
  if (status !== 503 || typeof payload !== 'object' || payload === null) return false
  const record = payload as Record<string, unknown>
  return record.ok === false && record.code === 'MAINTENANCE'
}
