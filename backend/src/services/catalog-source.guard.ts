import { env } from '../utils/env'

export class CatalogLockedError extends Error {
  statusCode = 423

  code = 'LOCKED' as const

  constructor(message = 'Каталог в режиме Google Sheets — изменения заблокированы.') {
    super(message)
    this.name = 'CatalogLockedError'
  }
}

export const isCatalogCrmWritable = (): boolean => env.catalogSource === 'crm'

export const assertCatalogCrmWritable = (): void => {
  if (env.catalogSource !== 'crm') {
    throw new CatalogLockedError()
  }
}
