import { ApiError, type ApiResponse } from './api-error'

const EMPTY_OR_INVALID_JSON =
  'Не удалось разобрать ответ сервера. Если файл большой — сожмите изображение (лимит 15 МБ) или проверьте сеть.'

const PAYLOAD_TOO_LARGE =
  'Файл больше 15 МБ. Сожмите изображение или уменьшите разрешение.'

function isSafariPatternError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return msg.includes('expected pattern') || msg.includes('did not match')
}

/**
 * Safely parse API JSON from a Response.
 * Empty bodies (nginx 413) and Safari "expected pattern" → ApiError with RU hints.
 */
export async function parseApiJson<T>(res: Response): Promise<ApiResponse<T>> {
  let text: string
  try {
    text = await res.text()
  } catch (err) {
    if (res.status === 413 || isSafariPatternError(err)) {
      throw new ApiError(PAYLOAD_TOO_LARGE, res.status === 413 ? 413 : res.status || 413)
    }
    throw new ApiError(EMPTY_OR_INVALID_JSON, res.status || 502)
  }

  const trimmed = text.trim()
  if (!trimmed) {
    if (res.status === 413) {
      throw new ApiError(PAYLOAD_TOO_LARGE, 413)
    }
    throw new ApiError(EMPTY_OR_INVALID_JSON, res.status || 502)
  }

  try {
    return JSON.parse(trimmed) as ApiResponse<T>
  } catch (err) {
    if (res.status === 413 || isSafariPatternError(err)) {
      throw new ApiError(PAYLOAD_TOO_LARGE, res.status === 413 ? 413 : res.status || 413)
    }
    throw new ApiError(EMPTY_OR_INVALID_JSON, res.status || 502)
  }
}
