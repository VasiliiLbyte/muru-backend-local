import { Fragment, useCallback, useEffect, useState } from 'react'

import { CatalogImageUploadField } from '../../components/catalog/CatalogImageUploadField'
import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { ApiError } from '../../lib/api'
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  listCategories,
  patchCategory,
  patchSubcategory,
} from '../../lib/catalog-api'
import type { CrmCategoryItem, CrmCategorySubcategoryItem } from '../../types/catalog'

type EditingSub = {
  categoryId: number
  subId: number
  name: string
  coverUrl: string
}

const getDeleteTitle = (item: CrmCategoryItem): string => {
  if (item.isUnused) return 'Удалить категорию'
  if (item.directProductCount > 0) return 'Есть активные товары в категории'
  if (item.subcategories.some((s) => s.productCount > 0)) return 'Есть подкатегории с товарами'
  if (item.crossPlacementCount > 0) return 'Категория используется в cross-placements'
  return 'Категорию нельзя удалить'
}

const getSubDeleteTitle = (sub: CrmCategorySubcategoryItem): string =>
  sub.productCount > 0 ? 'Есть активные товары в подкатегории' : 'Удалить подкатегорию'

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

  const [newSubNames, setNewSubNames] = useState<Record<number, string>>({})
  const [creatingSubFor, setCreatingSubFor] = useState<number | null>(null)
  const [editingSub, setEditingSub] = useState<EditingSub | null>(null)
  const [savingSub, setSavingSub] = useState(false)
  const [movingSubKey, setMovingSubKey] = useState('')

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

  const onCreateSubcategory = async (categoryId: number) => {
    const name = (newSubNames[categoryId] ?? '').trim()
    if (readOnly || !name) return
    setCreatingSubFor(categoryId)
    setError('')
    try {
      await createSubcategory(categoryId, { name })
      setNewSubNames((prev) => ({ ...prev, [categoryId]: '' }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать подкатегорию')
    } finally {
      setCreatingSubFor(null)
    }
  }

  const startEditSub = (categoryId: number, sub: CrmCategorySubcategoryItem) => {
    setEditingSub({
      categoryId,
      subId: sub.id,
      name: sub.name,
      coverUrl: sub.coverImageUrl ?? '',
    })
  }

  const onSaveSubEdit = async () => {
    if (readOnly || editingSub == null) return
    setSavingSub(true)
    setError('')
    try {
      await patchSubcategory(editingSub.categoryId, editingSub.subId, {
        name: editingSub.name.trim(),
        coverImageUrl: editingSub.coverUrl.trim() || null,
      })
      setEditingSub(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить подкатегорию')
    } finally {
      setSavingSub(false)
    }
  }

  const onDeleteSubcategory = async (categoryId: number, sub: CrmCategorySubcategoryItem) => {
    if (readOnly || sub.productCount > 0) return
    if (!window.confirm(`Удалить подкатегорию «${sub.name}»?`)) return
    setError('')
    try {
      await deleteSubcategory(categoryId, sub.id)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось удалить подкатегорию')
      }
    }
  }

  const moveSubcategory = async (
    categoryId: number,
    subs: CrmCategorySubcategoryItem[],
    index: number,
    direction: -1 | 1,
  ) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= subs.length) return
    const current = subs[index]
    const neighbor = subs[targetIndex]
    const key = `${categoryId}-${current.id}`
    setMovingSubKey(key)
    setError('')
    try {
      await patchSubcategory(categoryId, current.id, { sortOrder: neighbor.sortOrder })
      await patchSubcategory(categoryId, neighbor.id, { sortOrder: current.sortOrder })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить порядок')
    } finally {
      setMovingSubKey('')
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
                  <tr>
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
                  {item.subcategories.map((sub, subIndex) => {
                    const isEditing =
                      editingSub?.categoryId === item.id && editingSub.subId === sub.id

                    return (
                      <tr key={sub.id} className="catalog-subcategory-row">
                        <td>
                          {isEditing ? (
                            <input
                              className="field-input"
                              value={editingSub.name}
                              onChange={(e) =>
                                setEditingSub({ ...editingSub, name: e.target.value })
                              }
                              autoFocus
                            />
                          ) : (
                            sub.name
                          )}
                        </td>
                        <td>{sub.slug}</td>
                        <td>{sub.productCount}</td>
                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className="field-input"
                                value={editingSub.coverUrl}
                                onChange={(e) =>
                                  setEditingSub({ ...editingSub, coverUrl: e.target.value })
                                }
                              />
                              <CatalogImageUploadField
                                label="Обложка"
                                onSuccess={(result) =>
                                  setEditingSub({ ...editingSub, coverUrl: result.url })
                                }
                              />
                            </>
                          ) : sub.coverImageUrl ? (
                            <img src={sub.coverImageUrl} alt="" className="order-thumb" />
                          ) : (
                            '—'
                          )}
                        </td>
                        {!readOnly ? (
                          <td>
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="link-button"
                                  disabled={savingSub || !editingSub.name.trim()}
                                  onClick={() => void onSaveSubEdit()}
                                >
                                  {savingSub ? 'Сохранение…' : 'Сохранить'}
                                </button>
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={() => setEditingSub(null)}
                                >
                                  Отмена
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="link-button"
                                  disabled={subIndex === 0 || movingSubKey !== ''}
                                  onClick={() =>
                                    void moveSubcategory(item.id, item.subcategories, subIndex, -1)
                                  }
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="link-button"
                                  disabled={
                                    subIndex === item.subcategories.length - 1 ||
                                    movingSubKey !== ''
                                  }
                                  onClick={() =>
                                    void moveSubcategory(item.id, item.subcategories, subIndex, 1)
                                  }
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={() => startEditSub(item.id, sub)}
                                >
                                  Изменить
                                </button>
                                <button
                                  type="button"
                                  className="link-button"
                                  disabled={sub.productCount > 0}
                                  title={getSubDeleteTitle(sub)}
                                  onClick={() => void onDeleteSubcategory(item.id, sub)}
                                >
                                  Удалить
                                </button>
                              </>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                  {!readOnly ? (
                    <tr className="catalog-subcategory-row">
                      <td colSpan={5}>
                        <div className="form-actions">
                          <input
                            className="field-input"
                            value={newSubNames[item.id] ?? ''}
                            onChange={(e) =>
                              setNewSubNames((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder="Новая подкатегория"
                          />
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={
                              creatingSubFor === item.id ||
                              !(newSubNames[item.id] ?? '').trim()
                            }
                            onClick={() => void onCreateSubcategory(item.id)}
                          >
                            {creatingSubFor === item.id ? 'Создание…' : 'Добавить подкатегорию'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
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
