/** Преобразует строку в формат +7XXXXXXXXXX. Возвращает null если телефон невалиден. */
export const normalizeRussianPhone = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`
  }
  if (digits.length === 10) return `+7${digits}`
  if (digits.length === 12 && raw.trim().startsWith('+')) return `+${digits}`
  return null
}
