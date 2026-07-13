import { Fragment, useCallback, useEffect, useState } from 'react'

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
import type { CrmCategoryItem, CrmCategorySubcategoryItem } from '../../types/catalog'

type RenamingSub = {
  categoryId: number
  oldName: string
}

const getDeleteTitle = (item: CrmCategoryItem): string => {
  if (item.isUnused) return 'Удалить категорию'
  if (item.directProductCount > 0) return 'Есть активные товары в категории'
  if (item.subcategories.length > 0) return 'Есть подкатегории с товарами'
  if (item.crossPlacementCount > 0) return 'Категория используется в cross-placements'
  return 'Категорию нельзя удалить'
}

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

  const [renamingSub, setRenamingSub] = useState<RenamingSub | null>(null)
  const [renameInput, setRenameInput] = useState('')
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
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось удалить категорию')
      }
    }
  }

  const startRenameSub = (categoryId: number, sub: CrmCategorySubcategoryItem) => {
    setRenamingSub({ categoryId, oldName: sub.name })
    setRenameInput(sub.name)
  }

  const cancelRenameSub = () => {
    setRenamingSub(null)
    setRenameInput('')
  }

  const onRenameSubcategory = async (categoryId: number, oldName: string) => {
    if (readOnly || !renameInput.trim()) return
    setRenaming(true)
    setError('')
    try {
      await renameSubcategory({
        categoryId,
        oldSubcategoryName: oldName,
        newSubcategoryName: renameInput.trim(),
      })
      setRenamingSub(null)
      setRenameInput('')
      await load()
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
        <div className="table-wrap catalog-category-tree">
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
                <Fragment key={item.id}>
                  <tr key={item.id}>
                    <td>
                      {item.name}
                      {item.isUnused ? (
                        <span className="catalog-badge-unused">Не используется</span>
                      ) : null}
                    </td>
                    <td>{item.slug}</td>
                    <td>
                      {item.directProductCount}
                      {item.crossPlacementCount > 0 ? (
                        <span
                          className="catalog-badge-cross"
                          title="Cross-placement товаров"
                        >
                          +{item.crossPlacementCount} cross
                        </span>
                      ) : null}
                    </td>
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
                          disabled={!item.isUnused}
                          title={getDeleteTitle(item)}
                          onClick={() => void onDelete(item.id)}
                        >
                          Удалить
                        </button>
                      </td>
                    ) : null}
                  </tr>
                  {item.subcategories.map((sub) => {
                    const isRenaming =
                      renamingSub?.categoryId === item.id && renamingSub.oldName === sub.name

                    return (
                      <tr
                        key={`${item.id}-${sub.slug}`}
                        className="catalog-subcategory-row"
                      >
                        <td>
                          {isRenaming ? (
                            <input
                              className="field-input"
                              value={renameInput}
                              onChange={(e) => setRenameInput(e.target.value)}
                              autoFocus
                            />
                          ) : (
                            sub.name
                          )}
                        </td>
                        <td>{sub.slug}</td>
                        <td>{sub.productCount}</td>
                        <td>—</td>
                        {!readOnly ? (
                          <td>
                            {isRenaming ? (
                              <>
                                <button
                                  type="button"
                                  className="link-button"
                                  disabled={renaming || !renameInput.trim()}
                                  onClick={() =>
                                    void onRenameSubcategory(item.id, sub.name)
                                  }
                                >
                                  {renaming ? 'Сохранение…' : 'Сохранить'}
                                </button>
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={cancelRenameSub}
                                >
                                  Отмена
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="link-button"
                                onClick={() => startRenameSub(item.id, sub)}
                              >
                                Переименовать
                              </button>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </Fragment>
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
    </section>
  )
}
