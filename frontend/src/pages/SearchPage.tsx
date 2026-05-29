import { useEffect, useRef, useState } from 'react'

import { ProductCard } from '../components/ProductCard'
import { catalogSearchInputClassName } from '../lib/catalogSearchInputClass'
import { fetchCatalogProducts } from '../lib/api'
import { pressable } from '../lib/uiClasses'
import type { CatalogProduct } from '../types/catalog'

type SearchPageProps = {
  query: string
  onQueryChange: (value: string) => void
  onOpenProductDetail: (sku: string) => void
  onAddToCart: (product: CatalogProduct) => void
  onNotifyRestock: (product: CatalogProduct) => void
  onGoToCatalog: () => void
}

const AnimatedSearchLoupe = () => (
  <div
    className="muru-search-loupe text-muru-olive mx-auto flex h-28 w-28 items-center justify-center"
    aria-hidden
  >
    <svg viewBox="0 0 24 24" className="h-24 w-24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l5 5" strokeLinecap="round" />
    </svg>
  </div>
)

export const SearchPage = ({
  query,
  onQueryChange,
  onOpenProductDetail,
  onAddToCart,
  onNotifyRestock,
  onGoToCatalog,
}: SearchPageProps) => {
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const requestSeqRef = useRef(0)

  const trimmed = query.trim()

  useEffect(() => {
    const requestId = ++requestSeqRef.current
    const delayMs = trimmed ? 280 : 0
    const timeoutId = window.setTimeout(() => {
      if (requestSeqRef.current !== requestId) return
      if (!trimmed) {
        setProducts([])
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setProducts([])
      fetchCatalogProducts({ q: trimmed })
        .then((items) => {
          if (requestSeqRef.current !== requestId) return
          setProducts(items)
        })
        .catch(() => {
          if (requestSeqRef.current !== requestId) return
          setProducts([])
        })
        .finally(() => {
          if (requestSeqRef.current !== requestId) return
          setIsLoading(false)
        })
    }, delayMs)

    return () => window.clearTimeout(timeoutId)
  }, [trimmed])

  const showEmpty = !isLoading && trimmed.length > 0 && products.length === 0
  const showResults = !isLoading && trimmed.length > 0 && products.length > 0

  return (
    <section className="space-y-4">
      <div className="mb-1">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Поиск по названию или артикулу"
          className={catalogSearchInputClassName}
          autoComplete="off"
        />
      </div>

      {!trimmed ? (
        <p className="text-center text-sm text-[#6f6666]">Введите название или артикул (MUxxxx)</p>
      ) : null}

      {isLoading && trimmed ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="h-56 animate-pulse rounded-2xl bg-[#efe8d8]" />
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="flex flex-col items-center rounded-2xl border border-muru-accent bg-[#fff9ed] px-4 py-10 text-center">
          <p className="text-sm text-muru-text">
            Результаты по запросу: <span className="font-semibold text-blue-600">{trimmed}</span>
          </p>
          <AnimatedSearchLoupe />
          <p className="mt-2 text-base font-medium text-[#5e5252]">Ничего не найдено</p>
          <button
            type="button"
            className={`${pressable} mt-6 rounded-xl bg-[#8f2b2b] px-6 py-3 text-sm font-semibold text-[#fff5ef]`}
            onClick={onGoToCatalog}
          >
            Перейти в каталог
          </button>
        </div>
      ) : null}

      {showResults ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((product, i) => (
            <ProductCard
              key={product.sku}
              index={i}
              product={product}
              onOpenDetail={onOpenProductDetail}
              onAddToCart={onAddToCart}
              onNotifyRestock={onNotifyRestock}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
