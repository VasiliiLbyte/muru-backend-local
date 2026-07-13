import { env } from '../utils/env'

export class CatalogLockedError extends Error {
  statusCode = 423

  code = 'LOCKED' as const

  constructor(message = 'Catalog is in sheets mode; mutations are locked') {
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
