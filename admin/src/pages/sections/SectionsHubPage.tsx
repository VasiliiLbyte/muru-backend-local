import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { createCategory, listCategories } from '../../lib/catalog-api'
import { categoryCoverPreviewSrc, SALE_CATEGORY_NAME } from '../../lib/category-cover'
import type { CrmCategoryItem } from '../../types/catalog'

const sectionLinks = [
  { to: '/catalog/sections/inspiration', label: 'Вдохновение', hint: 'Лукбуки витрины' },
  { to: '/catalog/sections/collections', label: 'Коллекции', hint: 'Подборки товаров' },
  { to: '/catalog/sections/gift-guide', label: 'Гид по подаркам', hint: 'Товары с флагом gift guide' },
] as const

export const SectionsHubPage = () => {
  const { readOnly } = useCatalogMetaContext()

  const [items, setItems] = useState<CrmCategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listCategories()
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить категории')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (readOnly || !newName.trim()) return
    setCreating(true)
    setError('')
    try {
      await createCategory({ name: newName.trim() })
      setNewName('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать категорию')
    } finally {
      setCreating(false)
    }
  }

  const renderCategoryRow = (item: CrmCategoryItem) => {
    const isSale = item.name === SALE_CATEGORY_NAME
    const coverSrc = categoryCoverPreviewSrc(item.coverImageUrl)

    return (
      <tr key={item.id}>
        <td>
          <Link className="link-button" to={`/catalog/sections/categories/${item.id}`}>
            {item.name}
          </Link>
          {isSale ? (
            <span className="catalog-badge-cross" title="Виртуальная категория">
              виртуальная
            </span>
          ) : null}
          {!isSale && item.isUnused ? (
            <span className="catalog-badge-unused">Не используется</span>
          ) : null}
        </td>
        <td>{item.slug}</td>
        <td>
          {item.directProductCount}
          {item.crossPlacementCount > 0 ? (
            <span className="catalog-badge-cross" title="Cross-placement товаров">
              +{item.crossPlacementCount} cross
            </span>
          ) : null}
        </td>
        <td>{coverSrc ? <img src={coverSrc} alt="" className="order-thumb" /> : '—'}</td>
        <td>
          <Link className="link-button" to={`/catalog/sections/categories/${item.id}`}>
            {isSale ? 'Просмотр' : 'Управление'}
          </Link>
        </td>
      </tr>
    )
  }

  return (
    <section className="orders-module">
      <h3 className="content-title">Разделы витрины</h3>
      {error ? <p className="error-text">{error}</p> : null}

      <div className="form-section">
        <h4 className="form-section-title">Контентные разделы</h4>
        <ul className="catalog-section-links">
          {sectionLinks.map((link) => (
            <li key={link.to}>
              <Link className="link-button" to={link.to}>
                {link.label}
              </Link>
              <span className="muted-text"> — {link.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      {!readOnly ? (
        <form className="form-section" onSubmit={onCreate}>
          <h4 className="form-section-title">Создать категорию</h4>
          <input
            className="field-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название"
            required
          />
          <button type="submit" className="primary-button" disabled={creating}>
            {creating ? 'Создание…' : 'Создать'}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="muted-text">Загрузка...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Категория</th>
                <th>Slug</th>
                <th>Товаров</th>
                <th>Обложка</th>
                <th />
              </tr>
            </thead>
            <tbody>{items.map(renderCategoryRow)}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}
