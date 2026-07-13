import { useEffect, useState } from 'react'

import { getCatalogMeta } from '../lib/catalog-api'
import type { CrmCatalogMeta } from '../types/catalog'

let cachedMeta: CrmCatalogMeta | null = null
let loadPromise: Promise<CrmCatalogMeta> | null = null

const fetchMeta = async (): Promise<CrmCatalogMeta> => {
  if (cachedMeta) return cachedMeta
  if (!loadPromise) {
    loadPromise = getCatalogMeta().then((meta) => {
      cachedMeta = meta
      return meta
    })
  }
  return loadPromise
}

export const useCatalogMeta = () => {
  const [meta, setMeta] = useState<CrmCatalogMeta | null>(cachedMeta)
  const [loading, setLoading] = useState(!cachedMeta)
  const [error, setError] = useState('')

  useEffect(() => {
    if (cachedMeta) {
      setMeta(cachedMeta)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void fetchMeta()
      .then((data) => {
        if (!cancelled) setMeta(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить метаданные каталога')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    meta,
    loading,
    error,
    readOnly: meta?.readOnly ?? true,
    catalogSource: meta?.catalogSource ?? 'sheets',
  }
}
