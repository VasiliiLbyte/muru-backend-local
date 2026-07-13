export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё-]/gi, '')

export const conflictError = (message: string): Error => {
  const err = new Error(message)
  ;(err as Error & { statusCode?: number }).statusCode = 409
  return err
}

export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === '23505'
