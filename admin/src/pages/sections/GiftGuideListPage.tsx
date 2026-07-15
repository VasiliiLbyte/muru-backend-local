import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Plus, X } from 'lucide-react'

import {
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  SkeletonTable,
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '../../components/ui'
import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { listProducts, patchProduct } from '../../lib/catalog-api'
import type { CrmCatalogListItem, CrmCatalogListResult } from '../../types/catalog'
import { formatMoney } from '../../utils/order-labels'

const PAGE_SIZE = 20

export const GiftGuideListPage = () => {
  const { readOnly } = useCatalogMetaContext()
  const toast = useToast()

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
      toast.success('Товар убран из гида')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось убрать товар из гида'
      setError(message)
      toast.error(message)
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
      toast.success('Товар добавлен в гид')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось добавить товар'
      setAddError(message)
      toast.error(message)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Гид по подаркам"
        backTo="/catalog/sections"
        backLabel="К разделам"
        actions={
          !readOnly ? (
            <Button type="button" variant="secondary" onClick={() => setAddOpen((v) => !v)}>
              Добавить товар
            </Button>
          ) : undefined
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      <Field label="Поиск" htmlFor="gift-guide-q">
        <Input
          id="gift-guide-q"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Поиск по SKU или названию"
        />
      </Field>

      {loading ? (
        <SkeletonTable rows={6} cols={readOnly ? 3 : 4} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={Gift} title="Пока нет товаров в подборке подарков" />
      ) : (
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              <TableHead>SKU</TableHead>
              <TableHead>Название</TableHead>
              <TableHead numeric>Цена</TableHead>
              {!readOnly ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data!.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link className="muru-page-header__back" to={`/catalog/products/${item.id}`}>
                    {item.sku}
                  </Link>
                </TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell numeric>{formatMoney(item.price)}</TableCell>
                {!readOnly ? (
                  <TableCell>
                    <TableActions>
                      <IconButton
                        variant="danger"
                        aria-label="Убрать из гида"
                        disabled={togglingId === item.id}
                        onClick={() => void onRemove(item)}
                      >
                        <X size={16} />
                      </IconButton>
                    </TableActions>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 ? (
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
      ) : null}

      {addOpen && !readOnly ? (
        <Card title="Добавить товар в гид">
          {addError ? <p className="error-text">{addError}</p> : null}
          <div className="form-actions">
            <Input
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="SKU или название"
            />
            <Button
              type="button"
              loading={addLoading}
              disabled={!addQuery.trim()}
              onClick={() => void onSearchAdd()}
            >
              Найти
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Закрыть
            </Button>
          </div>
          {addResults.length > 0 ? (
            <Table>
              <TableBody>
                {addResults.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.sku} — {item.name}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        aria-label="Добавить в гид"
                        disabled={addingId === item.id}
                        onClick={() => void onAdd(item)}
                      >
                        <Plus size={16} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </Card>
      ) : null}
    </section>
  )
}
