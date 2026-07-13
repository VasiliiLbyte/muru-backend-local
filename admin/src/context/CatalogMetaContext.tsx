import { createContext, useContext } from 'react'

import { useCatalogMeta } from '../hooks/useCatalogMeta'
import type { CrmCatalogMeta } from '../types/catalog'

type CatalogMetaContextValue = {
  meta: CrmCatalogMeta | null
  loading: boolean
  error: string
  readOnly: boolean
  catalogSource: 'sheets' | 'crm'
}

const CatalogMetaContext = createContext<CatalogMetaContextValue | null>(null)

export const CatalogMetaProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useCatalogMeta()
  return <CatalogMetaContext.Provider value={value}>{children}</CatalogMetaContext.Provider>
}

export const useCatalogMetaContext = (): CatalogMetaContextValue => {
  const ctx = useContext(CatalogMetaContext)
  if (!ctx) {
    throw new Error('useCatalogMetaContext must be used within CatalogMetaProvider')
  }
  return ctx
}
