import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { listProducts, patchProduct } from '../../lib/catalog-api'
import type { CrmCatalogListItem, CrmCatalogListResult } from '../../types/catalog'
import { formatMoney } from '../../utils/order-labels'

const PAGE_SIZE = 20

export const GiftGuideListPage = () => {
  const { readOnly } = useCatalogMetaContext()

  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CrmCatalogListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addResults, setAddResults] = useState<CrmCatalogListItem[]>([])
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addingId, setAddingId] = useState<number | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setQ(qInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [qInput])

  useEffect(() => {
    setPage(1)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listProducts({
        giftGuide: 'true',
        q: q || undefined,
        archived: 'false',
        page,
        pageSize: PAGE_SIZE,
      })
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить подборку')
    } finally {
      setLoading(false)
    }
  }, [q, page])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = useMemo(() => {
    if (!data) return 1
    return Math.max(1, Math.ceil(data.total / data.pageSize))
  }, [data])

  const onRemove = async (item: CrmCatalogListItem) => {
    if (readOnly) return
    setTogglingId(item.id)
    setError('')
    try {
      await patchProduct(item.id, { isGiftGuide: false })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось убрать товар из гида')
    } finally {
      setTogglingId(null)
    }
  }

  const onSearchAdd = async () => {
    const trimmed = addQuery.trim()
    if (!trimmed) return
    setAddLoading(true)
    setAddError('')
    try {
      const result = await listProducts({
        q: trimmed,
        archived: 'false',
        page: 1,
        pageSize: 20,
      })
      setAddResults(result.items.filter((item) => !item.isGiftGuide))
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Не удалось найти товары')
    } finally {
      setAddLoading(false)
    }
  }

  const onAdd = async (item: CrmCatalogListItem) => {
    if (readOnly) return
    setAddingId(item.id)
    setAddError('')
    try {
      await patchProduct(item.id, { isGiftGuide: true })
      setAddResults((prev) => prev.filter((row) => row.id !== item.id))
      await load()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Не удалось добавить товар')
    } finally {
      setAddingId(null)
    }
  }

  return (
    <section className="orders-module">
      <div className="content-form-header">
        <h3 className="content-title">Гид по подаркам</h3>
        {!readOnly ? (
          <button type="button" className="secondary-button" onClick={() => setAddOpen(true)}>
            Добавить товар
          </button>
        ) : null}
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="form-section">
        <input
          className="field-input"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Поиск по SKU или названию"
        />
      </div>

      {loading ? (
        <p className="muted-text">Загрузка...</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="muted-text">Пока нет товаров в подборке подарков</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Название</th>
                <th>Цена</th>
                {!readOnly ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {data!.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="link-button" to={`/catalog/products/${item.id}`}>
                      {item.sku}
                    </Link>
                  </td>
                  <td>{item.name}</td>
                  <td>{formatMoney(item.price)}</td>
                  {!readOnly ? (
                    <td>
                      <button
                        type="button"
                        className="link-button"
                        disabled={togglingId === item.id}
                        onClick={() => void onRemove(item)}
                      >
                        {togglingId === item.id ? 'Сохранение…' : 'Убрать из гида'}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="form-actions">
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
      ) : null}

      {addOpen ? (
        <div className="form-section">
          <h4 className="form-section-title">Добавить товар в гид</h4>
          {addError ? <p className="error-text">{addError}</p> : null}
          <div className="form-actions">
            <input
              className="field-input"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="SKU или название"
            />
            <button
              type="button"
              className="primary-button"
              disabled={addLoading || !addQuery.trim()}
              onClick={() => void onSearchAdd()}
            >
              {addLoading ? 'Поиск…' : 'Найти'}
            </button>
            <button type="button" className="secondary-button" onClick={() => setAddOpen(false)}>
              Закрыть
            </button>
          </div>
          {addResults.length > 0 ? (
            <ul className="catalog-section-links">
              {addResults.map((item) => (
                <li key={item.id}>
                  {item.sku} — {item.name}
                  <button
                    type="button"
                    className="link-button"
                    disabled={addingId === item.id}
                    onClick={() => void onAdd(item)}
                  >
                    {addingId === item.id ? 'Добавление…' : 'Добавить'}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
