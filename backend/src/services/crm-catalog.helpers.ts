import { slugifyLatin } from './slug-translit'

/** Canonical latin slug generator (Bitrix CyrillicToLatin). */
export const slugify = (value: string): string => slugifyLatin(value) || 'bez-kategorii'

export const conflictError = (message: string): Error => {
  const err = new Error(message)
  ;(err as Error & { statusCode?: number }).statusCode = 409
  return err
}

export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === '23505'

export const isForeignKeyViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === '23503'
