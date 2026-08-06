import { useCallback, useEffect, useState } from 'react'
import { History } from 'lucide-react'

import {
  Badge,
  Button,
  Card,
  EmptyState,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '../ui'
import {
  getProductImportLog,
  listProductImportLogs,
} from '../../lib/catalog-api'
import type {
  ProductImportLogDetail,
  ProductImportLogListItem,
} from '../../types/catalog'

const modeLabel = (mode: ProductImportLogListItem['mode']) =>
  mode === 'new' ? 'Только новые' : 'Создать или обновить'

const formatWhen = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('ru-RU')
  } catch {
    return iso
  }
}

type ProductImportLogPanelProps = {
  refreshToken: number
}

export const ProductImportLogPanel = ({ refreshToken }: ProductImportLogPanelProps) => {
  const toast = useToast()
  const [items, setItems] = useState<ProductImportLogListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ProductImportLogDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const { items: next } = await listProductImportLogs()
      setItems(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось загрузить лог импортов')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadList()
  }, [loadList, refreshToken])

  const onSelect = async (id: number) => {
    if (selectedId === id) {
      setSelectedId(null)
      setDetail(null)
      return
    }
    setSelectedId(id)
    setDetailLoading(true)
    setDetail(null)
    try {
      const next = await getProductImportLog(id)
      setDetail(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось загрузить детали прогона')
      setSelectedId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <Card title="Лог импортов">
      <div className="form-stack">
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={() => void loadList()}>
            Обновить
          </Button>
        </div>
        {loading ? <SkeletonTable rows={4} cols={5} /> : null}
        {!loading && items.length === 0 ? (
          <EmptyState
            icon={History}
            title="Пока нет прогонов"
            description="После импорта здесь появятся записи."
          />
        ) : null}
        {!loading && items.length > 0 ? (
          <Table>
            <TableHeader sticky>
              <TableRow hover={false}>
                <TableHead numeric>№</TableHead>
                <TableHead>Когда</TableHead>
                <TableHead>Файл</TableHead>
                <TableHead>Режим</TableHead>
                <TableHead>Кто</TableHead>
                <TableHead>Итог</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} onClick={() => void onSelect(item.id)}>
                  <TableCell numeric>{item.id}</TableCell>
                  <TableCell>{formatWhen(item.createdAt)}</TableCell>
                  <TableCell>{item.filename || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="neutral">{modeLabel(item.mode)}</Badge>
                  </TableCell>
                  <TableCell>
                    {item.adminEmail ?? (item.adminId != null ? `admin:${item.adminId}` : '—')}
                  </TableCell>
                  <TableCell>
                    +{item.summary.toCreate} / ~{item.summary.toUpdate} / !{item.summary.errorRows} / Σ
                    {item.summary.total}
                    {item.durationMs != null ? ` · ${item.durationMs} ms` : ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}

        {selectedId != null ? (
          <div className="form-stack">
            <p className="muted-text">Детали прогона №{selectedId}</p>
            {detailLoading ? <SkeletonTable rows={3} cols={4} /> : null}
            {detail && !detailLoading ? (
              detail.errors.length === 0 ? (
                <p className="muted-text">Ошибок в прогоне нет.</p>
              ) : (
                <Table>
                  <TableHeader sticky>
                    <TableRow hover={false}>
                      <TableHead numeric>Строка</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Поле</TableHead>
                      <TableHead>Ошибка</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.errors.map((err, index) => (
                      <TableRow key={`${err.row}-${err.field}-${index}`}>
                        <TableCell numeric>{err.row}</TableCell>
                        <TableCell>{err.sku || '—'}</TableCell>
                        <TableCell>{err.field}</TableCell>
                        <TableCell>{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
