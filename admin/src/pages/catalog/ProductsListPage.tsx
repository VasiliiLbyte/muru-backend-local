import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import type { CrmCatalogListResult, CrmCategoryItem } from '../../types/catalog'
import { formatMoney } from '../../utils/order-labels'

const PAGE_SIZE = 20

type ArchivedFilter = 'false' | 'true' | 'all'
type StockFilter = 'all' | 'in' | 'out'
type GiftGuideFilter = 'all' | 'true' | 'false'

export const ProductsListPage = () => {
  const { readOnly } = useCatalogMetaContext()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()

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

      <div className="catalog-filters">
        <Field label="Поиск" htmlFor="catalog-q">
          <Input
            id="catalog-q"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="SKU или название"
          />
        </Field>

        <Field label="Категория" htmlFor="catalog-category">
          <Select
            id="catalog-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
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
          <Input
            id="catalog-subcategory"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
          />
        </Field>

        <Field label="Остаток" htmlFor="catalog-stock">
          <Select
            id="catalog-stock"
            value={inStock}
            onChange={(e) => setInStock(e.target.value as StockFilter)}
          >
            <option value="all">Все</option>
            <option value="in">В наличии</option>
            <option value="out">Нет в наличии</option>
          </Select>
        </Field>

        <Field label="Архив" htmlFor="catalog-archived">
          <Select
            id="catalog-archived"
            value={archived}
            onChange={(e) => setArchived(e.target.value as ArchivedFilter)}
          >
            <option value="false">Активные</option>
            <option value="true">Только архив</option>
            <option value="all">Все</option>
          </Select>
        </Field>

        <Field label="Гид по подаркам" htmlFor="catalog-gift-guide">
          <Select
            id="catalog-gift-guide"
            value={giftGuide}
            onChange={(e) => setGiftGuide(e.target.value as GiftGuideFilter)}
          >
            <option value="all">Все</option>
            <option value="true">Да</option>
            <option value="false">Нет</option>
          </Select>
        </Field>
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
        <SkeletonTable rows={8} cols={readOnly ? 7 : 8} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Package} title="Товары не найдены" />
      ) : (
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              {!readOnly ? <TableHead /> : null}
              <TableHead>SKU</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Подкатегория</TableHead>
              <TableHead numeric>Цена</TableHead>
              <TableHead numeric>Остаток</TableHead>
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
                  <Link className="muru-page-header__back" to={`/catalog/products/${item.id}`}>
                    {item.sku}
                  </Link>
                </TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.categoryName ?? '—'}</TableCell>
                <TableCell>{item.webSubcategoryName ?? '—'}</TableCell>
                <TableCell numeric>{formatMoney(item.price)}</TableCell>
                <TableCell numeric>{item.inStock}</TableCell>
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
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Назад
        </Button>
        <span className="muted-text">
          Страница {page} из {totalPages}
          {data ? ` · всего ${data.total}` : ''}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Вперёд
        </Button>
      </div>
    </section>
  )
}
