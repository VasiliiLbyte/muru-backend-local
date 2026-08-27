import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Package } from 'lucide-react'

import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirm,
  useToast,
} from '../../components/ui'
import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { archiveProduct, listCategories, listProducts } from '../../lib/catalog-api'
import { listCollections } from '../../lib/content-api'
import {
  buildProductsListSearch,
  parseProductsListSearch,
  type ProductsListArchivedFilter,
  type ProductsListSearchState,
  type ProductsListStockFilter,
  type ProductsListTriFilter,
} from '../../lib/products-list-search'
import { isSaleCategorySlug } from '../../lib/sale-category'
import type { CrmCatalogListResult, CrmCatalogSortBy, CrmCategoryItem } from '../../types/catalog'
import type { CrmCollectionDto } from '../../types/content'
import { formatMoney } from '../../utils/order-labels'
import { salePriceFromList } from '../../utils/product-price'

const PAGE_SIZE = 20

const formatNewArrivalDate = (value: string | null | undefined): string => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

type SubcategoryOption = {
  slug: string
  label: string
}

const buildSubcategoryOptions = (
  categorySlug: string,
  cats: CrmCategoryItem[],
): SubcategoryOption[] => {
  const selectedCategory = cats.find((cat) => cat.slug === categorySlug)
  if (selectedCategory) {
    return selectedCategory.subcategories.map((sub) => ({
      slug: sub.slug,
      label: sub.name,
    }))
  }

  const seen = new Set<string>()
  const options: SubcategoryOption[] = []
  for (const cat of cats) {
    for (const sub of cat.subcategories) {
      if (seen.has(sub.slug)) continue
      seen.add(sub.slug)
      options.push({
        slug: sub.slug,
        label: `${sub.name} (${cat.name})`,
      })
    }
  }
  return options
}

export const ProductsListPage = () => {
  const { readOnly } = useCatalogMetaContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const confirm = useConfirm()
  const toast = useToast()

  const list = useMemo(() => parseProductsListSearch(searchParams), [searchParams])

  const [qInput, setQInput] = useState(list.q)
  const [data, setData] = useState<CrmCatalogListResult | null>(null)
  const [categories, setCategories] = useState<CrmCategoryItem[]>([])
  const [collections, setCollections] = useState<CrmCollectionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkArchiving, setBulkArchiving] = useState(false)

  const patchList = useCallback(
    (patch: Partial<ProductsListSearchState>, resetPage = true) => {
      const next: ProductsListSearchState = {
        ...list,
        ...patch,
        ...(resetPage && patch.page === undefined ? { page: 1 } : {}),
      }
      setSearchParams(buildProductsListSearch(next), { replace: true })
    },
    [list, setSearchParams],
  )

  useEffect(() => {
    setQInput(list.q)
  }, [list.q])

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = qInput.trim()
      if (trimmed === list.q) return
      patchList({ q: trimmed })
    }, 300)
    return () => clearTimeout(timer)
  }, [qInput, list.q, patchList])

  useEffect(() => {
    void listCategories()
      .then((res) => setCategories(res.items))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    void listCollections()
      .then(setCollections)
      .catch(() => setCollections([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const collectionId = list.collectionId ? Number(list.collectionId) : undefined
      const result = await listProducts({
        q: list.q || undefined,
        category: list.category || undefined,
        subcategory: list.subcategory || undefined,
        collectionId:
          typeof collectionId === 'number' && Number.isInteger(collectionId) && collectionId > 0
            ? collectionId
            : undefined,
        inStock: list.inStock === 'all' ? undefined : list.inStock,
        archived: list.archived,
        giftGuide: list.giftGuide,
        newArrival: list.newArrival,
        page: list.page,
        pageSize: PAGE_SIZE,
        sortBy: list.sortBy === 'updatedAt' ? undefined : list.sortBy,
        sortDir: list.sortBy === 'updatedAt' ? undefined : list.sortDir,
      })
      setData(result)
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить товары')
    } finally {
      setLoading(false)
    }
  }, [list])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = useMemo(() => {
    if (!data) return 1
    return Math.max(1, Math.ceil(data.total / data.pageSize))
  }, [data])

  const subcategoryOptions = useMemo(
    () => buildSubcategoryOptions(list.category, categories),
    [categories, list.category],
  )
  const isSaleFilter = isSaleCategorySlug(list.category)

  const onCategoryChange = (nextCategory: string) => {
    let nextSubcategory = list.subcategory
    if (isSaleCategorySlug(nextCategory)) {
      nextSubcategory = ''
    } else {
      const nextOptions = buildSubcategoryOptions(nextCategory, categories)
      if (nextSubcategory && !nextOptions.some((opt) => opt.slug === nextSubcategory)) {
        nextSubcategory = ''
      }
    }
    patchList({ category: nextCategory, subcategory: nextSubcategory })
  }

  const onSort = (key: string) => {
    if (key !== 'sku' && key !== 'price' && key !== 'inStock' && key !== 'newArrivalAt') return
    if (list.sortBy === key) {
      patchList({ sortDir: list.sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      patchList({
        sortBy: key as CrmCatalogSortBy,
        sortDir: key === 'newArrivalAt' ? 'desc' : 'asc',
      })
    }
  }

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
    const ok = await confirm({
      title: 'Архивировать выбранные товары?',
      message: `Будет архивировано товаров: ${selectedIds.size}.`,
      confirmLabel: 'Архивировать',
      variant: 'danger',
    })
    if (!ok) return

    setBulkArchiving(true)
    setError('')

    const ids = [...selectedIds]
    const results = await Promise.allSettled(ids.map((id) => archiveProduct(id)))
    const failed = results.filter((r) => r.status === 'rejected').length
    const succeeded = ids.length - failed

    if (failed > 0) {
      toast.error(`Архивировано: ${succeeded}, ошибок: ${failed}`)
    } else {
      toast.success(`Архивировано товаров: ${succeeded}`)
    }
    setBulkArchiving(false)
    await load()
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Товары"
        actions={
          !readOnly ? (
            <Button type="button" onClick={() => navigate('/catalog/products/new')}>
              Создать товар
            </Button>
          ) : undefined
        }
      />

      <div className="filters-panel filters-panel--products">
        <div className="filters-panel__search">
          <Field label="Поиск" htmlFor="catalog-q">
            <Input
              id="catalog-q"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="SKU или название"
            />
          </Field>
        </div>

        <div className="filters-panel__row">
          <Field label="Категория" htmlFor="catalog-category">
            <Select
              id="catalog-category"
              value={list.category}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">Все</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Подкатегория" htmlFor="catalog-subcategory">
            <Select
              id="catalog-subcategory"
              value={list.subcategory}
              onChange={(e) => patchList({ subcategory: e.target.value })}
              disabled={isSaleFilter || subcategoryOptions.length === 0}
            >
              <option value="">Все</option>
              {subcategoryOptions.map((opt) => (
                <option key={opt.slug} value={opt.slug}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Остаток" htmlFor="catalog-stock">
            <Select
              id="catalog-stock"
              value={list.inStock}
              onChange={(e) =>
                patchList({ inStock: e.target.value as ProductsListStockFilter })
              }
            >
              <option value="all">Все</option>
              <option value="in">В наличии</option>
              <option value="out">Нет в наличии</option>
            </Select>
          </Field>

          <Field label="Архив" htmlFor="catalog-archived">
            <Select
              id="catalog-archived"
              value={list.archived}
              onChange={(e) =>
                patchList({ archived: e.target.value as ProductsListArchivedFilter })
              }
            >
              <option value="false">Активные</option>
              <option value="true">Только архив</option>
              <option value="all">Все</option>
            </Select>
          </Field>

          <Field label="Гид по подаркам" htmlFor="catalog-gift-guide">
            <Select
              id="catalog-gift-guide"
              value={list.giftGuide}
              onChange={(e) =>
                patchList({ giftGuide: e.target.value as ProductsListTriFilter })
              }
            >
              <option value="all">Все</option>
              <option value="true">Да</option>
              <option value="false">Нет</option>
            </Select>
          </Field>

          <Field label="Новинки" htmlFor="catalog-new-arrival">
            <Select
              id="catalog-new-arrival"
              value={list.newArrival}
              onChange={(e) =>
                patchList({ newArrival: e.target.value as ProductsListTriFilter })
              }
            >
              <option value="all">Все</option>
              <option value="true">Да</option>
              <option value="false">Нет</option>
            </Select>
          </Field>

          <Field label="Коллекция" htmlFor="catalog-collection">
            <Select
              id="catalog-collection"
              value={list.collectionId}
              onChange={(e) => patchList({ collectionId: e.target.value })}
            >
              <option value="">Все</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {!readOnly ? (
        <div className="catalog-bulk-bar">
          <Checkbox
            label="Выбрать все на странице"
            checked={allOnPageSelected}
            onChange={toggleSelectAll}
            disabled={pageIds.length === 0}
          />
          <Button
            type="button"
            variant="secondary"
            loading={bulkArchiving}
            disabled={selectedIds.size === 0}
            onClick={() => void onBulkArchive()}
          >
            Архивировать выбранные
          </Button>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <SkeletonTable rows={8} cols={readOnly ? 8 : 9} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Package} title="Товары не найдены" />
      ) : (
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              {!readOnly ? <TableHead /> : null}
              <TableHead
                sortable
                sortKey="sku"
                activeSort={list.sortBy}
                sortDir={list.sortDir}
                onSort={onSort}
              >
                SKU
              </TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Подкатегория</TableHead>
              <TableHead
                numeric
                sortable
                sortKey="price"
                activeSort={list.sortBy}
                sortDir={list.sortDir}
                onSort={onSort}
              >
                Цена к оплате
              </TableHead>
              <TableHead
                numeric
                sortable
                sortKey="inStock"
                activeSort={list.sortBy}
                sortDir={list.sortDir}
                onSort={onSort}
              >
                Остаток
              </TableHead>
              <TableHead
                sortable
                sortKey="newArrivalAt"
                activeSort={list.sortBy}
                sortDir={list.sortDir}
                onSort={onSort}
              >
                Дата новинки
              </TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id}>
                {!readOnly ? (
                  <TableCell>
                    <Checkbox
                      label=""
                      aria-label={`Выбрать ${item.sku}`}
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleRow(item.id)}
                    />
                  </TableCell>
                ) : null}
                <TableCell>
                  <Link
                    className="muru-page-header__back"
                    to={`/catalog/products/${item.id}`}
                    state={{ listSearch: location.search }}
                  >
                    {item.sku}
                  </Link>
                </TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.categoryName ?? '—'}</TableCell>
                <TableCell>{item.webSubcategoryName ?? '—'}</TableCell>
                <TableCell numeric>
                  {(() => {
                    const sale = salePriceFromList(item.price, item.discountPercent ?? 0)
                    const hasDiscount = (item.discountPercent ?? 0) > 0
                    return (
                      <>
                        <div>{formatMoney(sale)}</div>
                        {hasDiscount ? (
                          <div className="muted-text">
                            {formatMoney(item.price)} · −{item.discountPercent}%
                          </div>
                        ) : null}
                      </>
                    )
                  })()}
                </TableCell>
                <TableCell numeric>{item.inStock}</TableCell>
                <TableCell>
                  {item.isNewArrival ? formatNewArrivalDate(item.newArrivalAt) : '—'}
                </TableCell>
                <TableCell>
                  {item.isArchived ? <Badge variant="neutral">Архив</Badge> : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="orders-pagination">
        <Button
          type="button"
          variant="secondary"
          disabled={list.page <= 1}
          onClick={() => patchList({ page: Math.max(1, list.page - 1) }, false)}
        >
          Назад
        </Button>
        <span className="muted-text">
          Страница {list.page} из {totalPages}
          {data ? ` · всего ${data.total}` : ''}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={list.page >= totalPages}
          onClick={() => patchList({ page: list.page + 1 }, false)}
        >
          Вперёд
        </Button>
      </div>
    </section>
  )
}
