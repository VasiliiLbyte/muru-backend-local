import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { CatalogImageUploadField } from '../../components/catalog/CatalogImageUploadField'
import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { ApiError } from '../../lib/api'
import {
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  listCategories,
  patchCategory,
  patchSubcategory,
} from '../../lib/catalog-api'
import { categoryCoverPreviewSrc, SALE_CATEGORY_NAME } from '../../lib/category-cover'
import type { CrmCategoryItem, CrmCategorySubcategoryItem } from '../../types/catalog'

type EditingSub = {
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

export const CategoryDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const categoryId = Number(id)
  const { readOnly } = useCatalogMetaContext()

  const [category, setCategory] = useState<CrmCategoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editCoverUrl, setEditCoverUrl] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  const [newSubName, setNewSubName] = useState('')
  const [creatingSub, setCreatingSub] = useState(false)
  const [editingSub, setEditingSub] = useState<EditingSub | null>(null)
  const [savingSub, setSavingSub] = useState(false)
  const [movingSubKey, setMovingSubKey] = useState('')

  const isSale = category?.name === SALE_CATEGORY_NAME
  const isReadOnlyCategory = readOnly || isSale

  const load = useCallback(async () => {
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      setError('Некорректный ID категории')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await listCategories()
      const found = res.items.find((item) => item.id === categoryId) ?? null
      setCategory(found)
      if (found) {
        setEditName(found.name)
        setEditSlug(found.slug)
        setEditCoverUrl(found.coverImageUrl ?? '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить категорию')
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    void load()
  }, [load])

  const coverPreview = useMemo(
    () => categoryCoverPreviewSrc(editCoverUrl || category?.coverImageUrl),
    [editCoverUrl, category?.coverImageUrl],
  )

  const onSaveCategory = async () => {
    if (isReadOnlyCategory || category == null) return
    setSavingCategory(true)
    setError('')
    try {
      await patchCategory(category.id, {
        name: editName.trim(),
        slug: editSlug.trim(),
        coverImageUrl: editCoverUrl.trim() || null,
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить категорию')
    } finally {
      setSavingCategory(false)
    }
  }

  const onDeleteCategory = async () => {
    if (isReadOnlyCategory || category == null || !category.isUnused) return
    if (!window.confirm('Удалить категорию?')) return
    setError('')
    try {
      await deleteCategory(category.id)
      navigate('/catalog/sections')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось удалить категорию')
      }
    }
  }

  const onCreateSubcategory = async () => {
    if (isReadOnlyCategory || category == null || !newSubName.trim()) return
    setCreatingSub(true)
    setError('')
    try {
      await createSubcategory(category.id, { name: newSubName.trim() })
      setNewSubName('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать подкатегорию')
    } finally {
      setCreatingSub(false)
    }
  }

  const onSaveSubEdit = async () => {
    if (isReadOnlyCategory || category == null || editingSub == null) return
    setSavingSub(true)
    setError('')
    try {
      await patchSubcategory(category.id, editingSub.subId, {
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

  const onDeleteSubcategory = async (sub: CrmCategorySubcategoryItem) => {
    if (isReadOnlyCategory || category == null || sub.productCount > 0) return
    if (!window.confirm(`Удалить подкатегорию «${sub.name}»?`)) return
    setError('')
    try {
      await deleteSubcategory(category.id, sub.id)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось удалить подкатегорию')
      }
    }
  }

  const moveSubcategory = async (index: number, direction: -1 | 1) => {
    if (isReadOnlyCategory || category == null) return
    const subs = category.subcategories
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= subs.length) return
    const current = subs[index]
    const neighbor = subs[targetIndex]
    setMovingSubKey(`${current.id}`)
    setError('')
    try {
      await patchSubcategory(category.id, current.id, { sortOrder: neighbor.sortOrder })
      await patchSubcategory(category.id, neighbor.id, { sortOrder: current.sortOrder })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить порядок')
    } finally {
      setMovingSubKey('')
    }
  }

  if (loading) return <p className="muted-text">Загрузка...</p>

  if (!category) {
    return (
      <section className="orders-module">
        <p className="error-text">Категория не найдена</p>
        <Link className="link-button" to="/catalog/sections">
          ← К разделам
        </Link>
      </section>
    )
  }

  return (
    <section className="orders-module">
      <div className="content-form-header">
        <h3 className="content-title">
          {category.name}
          {isSale ? (
            <span className="catalog-badge-cross" title="Виртуальная категория">
              виртуальная
            </span>
          ) : null}
        </h3>
        <Link className="link-button" to="/catalog/sections">
          ← К разделам
        </Link>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="form-section">
        <h4 className="form-section-title">Категория</h4>
        {isReadOnlyCategory ? (
          <>
            <p>
              <span className="muted-text">Slug: </span>
              {category.slug}
            </p>
            <p>
              <span className="muted-text">Товаров: </span>
              {category.directProductCount}
            </p>
            {coverPreview ? (
              <img src={coverPreview} alt="" className="order-thumb" />
            ) : (
              <p className="muted-text">Обложка не задана</p>
            )}
          </>
        ) : (
          <>
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
            {coverPreview ? <img src={coverPreview} alt="" className="order-thumb" /> : null}
            <div className="form-actions">
              <button
                type="button"
                className="primary-button"
                disabled={savingCategory}
                onClick={() => void onSaveCategory()}
              >
                {savingCategory ? 'Сохранение…' : 'Сохранить категорию'}
              </button>
              <button
                type="button"
                className="link-button"
                disabled={!category.isUnused}
                title={getDeleteTitle(category)}
                onClick={() => void onDeleteCategory()}
              >
                Удалить категорию
              </button>
            </div>
          </>
        )}
      </div>

      <div className="form-section">
        <h4 className="form-section-title">Подкатегории</h4>
        <div className="table-wrap catalog-category-tree">
          <table className="data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Slug</th>
                <th>Товаров</th>
                <th>Обложка</th>
                {!isReadOnlyCategory ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {category.subcategories.map((sub, subIndex) => {
                const isEditing = editingSub?.subId === sub.id
                const subCover = categoryCoverPreviewSrc(
                  isEditing ? editingSub.coverUrl : sub.coverImageUrl,
                )

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
                      ) : subCover ? (
                        <img src={subCover} alt="" className="order-thumb" />
                      ) : (
                        '—'
                      )}
                    </td>
                    {!isReadOnlyCategory ? (
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
                              onClick={() => void moveSubcategory(subIndex, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              disabled={
                                subIndex === category.subcategories.length - 1 ||
                                movingSubKey !== ''
                              }
                              onClick={() => void moveSubcategory(subIndex, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() =>
                                setEditingSub({
                                  subId: sub.id,
                                  name: sub.name,
                                  coverUrl: sub.coverImageUrl ?? '',
                                })
                              }
                            >
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              disabled={sub.productCount > 0}
                              title={getSubDeleteTitle(sub)}
                              onClick={() => void onDeleteSubcategory(sub)}
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
            </tbody>
          </table>
        </div>

        {!isReadOnlyCategory ? (
          <div className="form-actions">
            <input
              className="field-input"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="Новая подкатегория"
            />
            <button
              type="button"
              className="secondary-button"
              disabled={creatingSub || !newSubName.trim()}
              onClick={() => void onCreateSubcategory()}
            >
              {creatingSub ? 'Создание…' : 'Добавить подкатегорию'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
