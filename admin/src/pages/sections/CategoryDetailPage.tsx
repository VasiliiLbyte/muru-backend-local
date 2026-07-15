import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'

import { CatalogImageUploadField } from '../../components/catalog/CatalogImageUploadField'
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  PageHeader,
  SkeletonForm,
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirm,
  useToast,
} from '../../components/ui'
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
  const confirm = useConfirm()
  const toast = useToast()

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
      toast.success('Сохранено')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить категорию'
      setError(message)
      toast.error(message)
    } finally {
      setSavingCategory(false)
    }
  }

  const onDeleteCategory = async () => {
    if (isReadOnlyCategory || category == null || !category.isUnused) return
    const ok = await confirm({
      title: 'Удалить категорию?',
      message: `Категория «${category.name}» будет удалена без возможности восстановления.`,
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    setError('')
    try {
      await deleteCategory(category.id)
      toast.success('Категория удалена')
      navigate('/catalog/sections')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message)
        toast.error(err.message)
      } else {
        const message = err instanceof Error ? err.message : 'Не удалось удалить категорию'
        setError(message)
        toast.error(message)
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
      toast.success('Подкатегория создана')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось создать подкатегорию'
      setError(message)
      toast.error(message)
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
      toast.success('Сохранено')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить подкатегорию'
      setError(message)
      toast.error(message)
    } finally {
      setSavingSub(false)
    }
  }

  const onDeleteSubcategory = async (sub: CrmCategorySubcategoryItem) => {
    if (isReadOnlyCategory || category == null || sub.productCount > 0) return
    const ok = await confirm({
      title: 'Удалить подкатегорию?',
      message: `Подкатегория «${sub.name}» будет удалена без возможности восстановления.`,
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    setError('')
    try {
      await deleteSubcategory(category.id, sub.id)
      await load()
      toast.success('Подкатегория удалена')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message)
        toast.error(err.message)
      } else {
        const message = err instanceof Error ? err.message : 'Не удалось удалить подкатегорию'
        setError(message)
        toast.error(message)
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
      toast.success('Порядок обновлён')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось изменить порядок'
      setError(message)
      toast.error(message)
    } finally {
      setMovingSubKey('')
    }
  }

  if (loading) {
    return (
      <section className="page-stack">
        <SkeletonForm />
      </section>
    )
  }

  if (!category) {
    return (
      <section className="page-stack">
        <p className="error-text">Категория не найдена</p>
        <PageHeader title="Категория" backTo="/catalog/sections" backLabel="К разделам" />
      </section>
    )
  }

  return (
    <section className="page-stack">
      <PageHeader title={category.name} backTo="/catalog/sections" backLabel="К разделам" />
      {isSale ? (
        <Badge variant="neutral" className="inline-badge">
          виртуальная
        </Badge>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <Card title="Категория">
        {isReadOnlyCategory ? (
          <div className="form-stack">
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
          </div>
        ) : (
          <div className="form-stack">
            <Field label="Название" htmlFor="cat-name">
              <Input id="cat-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </Field>
            <Field label="Slug" htmlFor="cat-slug">
              <Input id="cat-slug" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
            </Field>
            <Field label="Cover URL" htmlFor="cat-cover">
              <Input
                id="cat-cover"
                value={editCoverUrl}
                onChange={(e) => setEditCoverUrl(e.target.value)}
              />
            </Field>
            <CatalogImageUploadField
              label="Загрузить обложку"
              onSuccess={(result) => setEditCoverUrl(result.url)}
            />
            {coverPreview ? <img src={coverPreview} alt="" className="order-thumb" /> : null}
            <div className="form-actions">
              <Button type="button" loading={savingCategory} onClick={() => void onSaveCategory()}>
                Сохранить категорию
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={!category.isUnused}
                title={getDeleteTitle(category)}
                onClick={() => void onDeleteCategory()}
              >
                Удалить категорию
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Подкатегории">
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              <TableHead>Название</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead numeric>Товаров</TableHead>
              <TableHead>Обложка</TableHead>
              {!isReadOnlyCategory ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {category.subcategories.map((sub, subIndex) => {
              const isEditing = editingSub?.subId === sub.id
              const subCover = categoryCoverPreviewSrc(
                isEditing ? editingSub.coverUrl : sub.coverImageUrl,
              )

              return (
                <TableRow key={sub.id} className="catalog-subcategory-row">
                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={editingSub.name}
                        onChange={(e) => setEditingSub({ ...editingSub, name: e.target.value })}
                        autoFocus
                      />
                    ) : (
                      sub.name
                    )}
                  </TableCell>
                  <TableCell>{sub.slug}</TableCell>
                  <TableCell numeric>{sub.productCount}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="form-stack">
                        <Input
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
                      </div>
                    ) : subCover ? (
                      <img src={subCover} alt="" className="order-thumb" />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  {!isReadOnlyCategory ? (
                    <TableCell>
                      {isEditing ? (
                        <TableActions>
                          <Button
                            type="button"
                            variant="secondary"
                            loading={savingSub}
                            disabled={!editingSub.name.trim()}
                            onClick={() => void onSaveSubEdit()}
                          >
                            Сохранить
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setEditingSub(null)}>
                            Отмена
                          </Button>
                        </TableActions>
                      ) : (
                        <TableActions>
                          <IconButton
                            aria-label="Переместить вверх"
                            disabled={subIndex === 0 || movingSubKey !== ''}
                            onClick={() => void moveSubcategory(subIndex, -1)}
                          >
                            <ArrowUp size={16} />
                          </IconButton>
                          <IconButton
                            aria-label="Переместить вниз"
                            disabled={
                              subIndex === category.subcategories.length - 1 || movingSubKey !== ''
                            }
                            onClick={() => void moveSubcategory(subIndex, 1)}
                          >
                            <ArrowDown size={16} />
                          </IconButton>
                          <IconButton
                            aria-label="Изменить"
                            onClick={() =>
                              setEditingSub({
                                subId: sub.id,
                                name: sub.name,
                                coverUrl: sub.coverImageUrl ?? '',
                              })
                            }
                          >
                            <Pencil size={16} />
                          </IconButton>
                          <IconButton
                            variant="danger"
                            aria-label="Удалить"
                            title={getSubDeleteTitle(sub)}
                            disabled={sub.productCount > 0}
                            onClick={() => void onDeleteSubcategory(sub)}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </TableActions>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {!isReadOnlyCategory ? (
          <div className="form-actions">
            <Input
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="Новая подкатегория"
            />
            <Button
              type="button"
              variant="secondary"
              loading={creatingSub}
              disabled={!newSubName.trim()}
              onClick={() => void onCreateSubcategory()}
            >
              Добавить подкатегорию
            </Button>
          </div>
        ) : null}
      </Card>
    </section>
  )
}
