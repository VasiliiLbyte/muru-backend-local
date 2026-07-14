import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { archiveProduct, listCategories, listProducts } from '../../lib/catalog-api'
import type { CrmCatalogListItem, CrmCatalogListResult, CrmCategoryItem } from '../../types/catalog'
import { formatMoney } from '../../utils/order-labels'

const PAGE_SIZE = 20

type ArchivedFilter = 'false' | 'true' | 'all'
type StockFilter = 'all' | 'in' | 'out'
type GiftGuideFilter = 'all' | 'true' | 'false'

export const ProductsListPage = () => {
  const { readOnly } = useCatalogMetaContext()

  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [inStock, setInStock] = useState<StockFilter>('all')
  const [archived, setArchived] = useState<ArchivedFilter>('false')
  const [giftGuide, setGiftGuide] = useState<GiftGuideFilter>('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CrmCatalogListResult | null>(null)
  const [categories, setCategories] = useState<CrmCategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkArchiving, setBulkArchiving] = useState(false)
  const [bulkMessage, setBulkMessage] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setQ(qInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [qInput])

  useEffect(() => {
    setPage(1)
  }, [q, category, subcategory, inStock, archived, giftGuide])

  useEffect(() => {
    void listCategories()
      .then((res) => setCategories(res.items))
      .catch(() => setCategories([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setBulkMessage('')
    try {
      const result = await listProducts({
        q: q || undefined,
        category: category || undefined,
        subcategory: subcategory || undefined,
        inStock: inStock === 'all' ? undefined : inStock,
        archived,
        giftGuide,
        page,
        pageSize: PAGE_SIZE,
      })
      setData(result)
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить товары')
    } finally {
      setLoading(false)
    }
  }, [q, category, subcategory, inStock, archived, giftGuide, page])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = useMemo(() => {
    if (!data) return 1
    return Math.max(1, Math.ceil(data.total / data.pageSize))
  }, [data])

  const pageIds = useMemo(() => (data?.items ?? []).map((item) => item.id), [data?.items])

  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of pageIds) next.delete(id)
        return next
      })
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of pageIds) next.add(id)
      return next
    })
  }

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onBulkArchive = async () => {
    if (readOnly || selectedIds.size === 0) return
    if (!window.confirm(`Архивировать выбранные товары (${selectedIds.size})?`)) return

    setBulkArchiving(true)
    setBulkMessage('')
    setError('')

    const ids = [...selectedIds]
    const results = await Promise.allSettled(ids.map((id) => archiveProduct(id)))
    const failed = results.filter((r) => r.status === 'rejected').length
    const succeeded = ids.length - failed

    setBulkMessage(
      failed > 0
        ? `Архивировано: ${succeeded}, ошибок: ${failed}`
        : `Архивировано товаров: ${succeeded}`,
    )
    setBulkArchiving(false)
    await load()
  }

  const renderRow = (item: CrmCatalogListItem) => (
    <tr key={item.id}>
      {!readOnly ? (
        <td>
          <input
            type="checkbox"
            checked={selectedIds.has(item.id)}
            onChange={() => toggleRow(item.id)}
            aria-label={`Выбрать ${item.sku}`}
          />
        </td>
      ) : null}
      <td>
        <Link className="link-button" to={`/catalog/products/${item.id}`}>
          {item.sku}
        </Link>
      </td>
      <td>{item.name}</td>
      <td>{item.categoryName ?? '—'}</td>
      <td>{item.webSubcategoryName ?? '—'}</td>
      <td>{formatMoney(item.price)}</td>
      <td>{item.inStock}</td>
      <td>
        {item.isArchived ? <span className="badge badge-hidden">Архив</span> : '—'}
      </td>
    </tr>
  )

  return (
    <section className="orders-module">
      <div className="content-form-header">
        <h3 className="content-title">Товары</h3>
        {!readOnly ? (
          <Link className="primary-button" to="/catalog/products/new">
            Создать товар
          </Link>
        ) : null}
      </div>

      <div className="orders-filters">
        <div className="orders-filter-row">
          <label className="field-label" htmlFor="catalog-q">
            Поиск
          </label>
          <input
            id="catalog-q"
            className="field-input orders-search-input"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="SKU или название"
          />

          <label className="field-label" htmlFor="catalog-category">
            Категория
          </label>
          <select
            id="catalog-category"
            className="field-input orders-filter-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Все</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>

          <label className="field-label" htmlFor="catalog-subcategory">
            Подкатегория
          </label>
          <input
            id="catalog-subcategory"
            className="field-input orders-filter-input"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
          />

          <label className="field-label" htmlFor="catalog-stock">
            Остаток
          </label>
          <select
            id="catalog-stock"
            className="field-input orders-filter-input"
            value={inStock}
            onChange={(e) => setInStock(e.target.value as StockFilter)}
          >
            <option value="all">Все</option>
            <option value="in">В наличии</option>
            <option value="out">Нет в наличии</option>
          </select>

          <label className="field-label" htmlFor="catalog-archived">
            Архив
          </label>
          <select
            id="catalog-archived"
            className="field-input orders-filter-input"
            value={archived}
            onChange={(e) => setArchived(e.target.value as ArchivedFilter)}
          >
            <option value="false">Активные</option>
            <option value="true">Только архив</option>
            <option value="all">Все</option>
          </select>

          <label className="field-label" htmlFor="catalog-gift-guide">
            Гид по подаркам
          </label>
          <select
            id="catalog-gift-guide"
            className="field-input orders-filter-input"
            value={giftGuide}
            onChange={(e) => setGiftGuide(e.target.value as GiftGuideFilter)}
          >
            <option value="all">Все</option>
            <option value="true">Да</option>
            <option value="false">Нет</option>
          </select>
        </div>
      </div>

      {!readOnly ? (
        <div className="catalog-bulk-bar">
          <label>
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleSelectAll}
              disabled={pageIds.length === 0}
            />{' '}
            Выбрать все на странице
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={bulkArchiving || selectedIds.size === 0}
            onClick={() => void onBulkArchive()}
          >
            {bulkArchiving ? 'Архивирование…' : 'Архивировать выбранные'}
          </button>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
      {bulkMessage ? <p className="muted-text">{bulkMessage}</p> : null}

      {loading ? (
        <p className="muted-text">Загрузка...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {!readOnly ? <th /> : null}
                <th>SKU</th>
                <th>Название</th>
                <th>Категория</th>
                <th>Подкатегория</th>
                <th>Цена</th>
                <th>Остаток</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {data && data.items.length > 0 ? (
                data.items.map(renderRow)
              ) : (
                <tr>
                  <td colSpan={readOnly ? 7 : 8} className="muted-text">
                    Товары не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="orders-pagination">
        <button
          type="button"
          className="secondary-button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Назад
        </button>
        <span className="muted-text">
          Страница {page} из {totalPages}
          {data ? ` · всего ${data.total}` : ''}
        </span>
        <button
          type="button"
          className="secondary-button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Вперёд
        </button>
      </div>
    </section>
  )
}
