import { useCallback, useEffect, useState } from 'react'

import { CatalogImageUploadField } from '../../components/catalog/CatalogImageUploadField'
import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { ApiError } from '../../lib/api'
import {
  createCategory,
  deleteCategory,
  listCategories,
  patchCategory,
  renameSubcategory,
} from '../../lib/catalog-api'
import type { CrmCategoryItem } from '../../types/catalog'

export const CategoriesPage = () => {
  const { readOnly } = useCatalogMetaContext()

  const [items, setItems] = useState<CrmCategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editCoverUrl, setEditCoverUrl] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [renameCategoryId, setRenameCategoryId] = useState('')
  const [oldSubcategoryName, setOldSubcategoryName] = useState('')
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [renameResult, setRenameResult] = useState('')
  const [renaming, setRenaming] = useState(false)

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

  const startEdit = (item: CrmCategoryItem) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditSlug(item.slug)
    setEditCoverUrl(item.coverImageUrl ?? '')
  }

  const onSaveEdit = async () => {
    if (readOnly || editingId == null) return
    setSavingEdit(true)
    setError('')
    try {
      await patchCategory(editingId, {
        name: editName.trim(),
        slug: editSlug.trim(),
        coverImageUrl: editCoverUrl.trim() || null,
      })
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить категорию')
    } finally {
      setSavingEdit(false)
    }
  }

  const onDelete = async (id: number) => {
    if (readOnly) return
    if (!window.confirm('Удалить категорию?')) return
    setError('')
    try {
      await deleteCategory(id)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Category has active products')
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось удалить категорию')
      }
    }
  }

  const onRenameSubcategory = async (event: React.FormEvent) => {
    event.preventDefault()
    if (readOnly) return
    setRenaming(true)
    setRenameResult('')
    setError('')
    try {
      const result = await renameSubcategory({
        categoryId: Number(renameCategoryId),
        oldSubcategoryName: oldSubcategoryName.trim(),
        newSubcategoryName: newSubcategoryName.trim(),
      })
      setRenameResult(`Обновлено товаров: ${result.updatedCount}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось переименовать подкатегорию')
    } finally {
      setRenaming(false)
    }
  }

  return (
    <section className="orders-module">
      <h3 className="content-title">Категории</h3>
      {error ? <p className="error-text">{error}</p> : null}

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
                <th>Название</th>
                <th>Slug</th>
                <th>Товаров</th>
                <th>Обложка</th>
                {!readOnly ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.slug}</td>
                  <td>{item.productCount}</td>
                  <td>
                    {item.coverImageUrl ? (
                      <img src={item.coverImageUrl} alt="" className="order-thumb" />
                    ) : (
                      '—'
                    )}
                  </td>
                  {!readOnly ? (
                    <td>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => startEdit(item)}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => void onDelete(item.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && editingId != null ? (
        <div className="form-section">
          <h4 className="form-section-title">Редактирование категории</h4>
          <label className="field-label">Название</label>
          <input
            className="field-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <label className="field-label">Slug</label>
          <input
            className="field-input"
            value={editSlug}
            onChange={(e) => setEditSlug(e.target.value)}
          />
          <label className="field-label">Cover URL</label>
          <input
            className="field-input"
            value={editCoverUrl}
            onChange={(e) => setEditCoverUrl(e.target.value)}
          />
          <CatalogImageUploadField
            label="Загрузить обложку"
            onSuccess={(result) => setEditCoverUrl(result.url)}
          />
          <div className="form-actions">
            <button
              type="button"
              className="primary-button"
              disabled={savingEdit}
              onClick={() => void onSaveEdit()}
            >
              {savingEdit ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button type="button" className="secondary-button" onClick={() => setEditingId(null)}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <form className="form-section" onSubmit={onRenameSubcategory}>
          <h4 className="form-section-title">Переименовать подкатегорию</h4>
          <label className="field-label">Категория</label>
          <select
            className="field-input"
            value={renameCategoryId}
            onChange={(e) => setRenameCategoryId(e.target.value)}
            required
          >
            <option value="">—</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <label className="field-label">Старое название</label>
          <input
            className="field-input"
            value={oldSubcategoryName}
            onChange={(e) => setOldSubcategoryName(e.target.value)}
            required
          />
          <label className="field-label">Новое название</label>
          <input
            className="field-input"
            value={newSubcategoryName}
            onChange={(e) => setNewSubcategoryName(e.target.value)}
            required
          />
          <button type="submit" className="primary-button" disabled={renaming}>
            {renaming ? 'Обновление…' : 'Переименовать'}
          </button>
          {renameResult ? <p className="muted-text">{renameResult}</p> : null}
        </form>
      ) : null}
    </section>
  )
}
