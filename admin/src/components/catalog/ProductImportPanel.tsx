import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  Badge,
  Button,
  Card,
  Field,
  FileDropzone,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirm,
  useToast,
} from '../ui'
import { ApiError } from '../../lib/api'
import {
  commitProductImport,
  downloadProductImportTemplate,
  previewProductImport,
} from '../../lib/catalog-api'
import type { ProductImportMode, ProductImportResult } from '../../types/catalog'

const TEMPLATE_COLUMNS =
  'Артикул*, Наименование*, Стоимость ₽*, Остаток*, Цвет, Размер, Описание, Бренд, Материал, Страна, Скидка %'

const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const actionLabel = (action: ProductImportResult['rows'][number]['action']) => {
  switch (action) {
    case 'create':
      return 'Создать'
    case 'update':
      return 'Обновить'
    case 'error':
      return 'Ошибка'
  }
}

const actionBadgeVariant = (
  action: ProductImportResult['rows'][number]['action'],
): 'success' | 'warning' | 'danger' | 'neutral' => {
  switch (action) {
    case 'create':
      return 'success'
    case 'update':
      return 'warning'
    case 'error':
      return 'danger'
    default:
      return 'neutral'
  }
}

type ProductImportPanelProps = {
  readOnly: boolean
  onCommitted: () => void
}

export const ProductImportPanel = ({ readOnly, onCommitted }: ProductImportPanelProps) => {
  const confirm = useConfirm()
  const toast = useToast()

  const [mode, setMode] = useState<ProductImportMode>('new')
  const [file, setFile] = useState<File | null>(null)
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [result, setResult] = useState<ProductImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [lastImportId, setLastImportId] = useState<number | null>(null)

  const previewMatchesFile = Boolean(file && previewKey && previewKey === fileKey(file))
  const canCommit = !readOnly && Boolean(file) && previewMatchesFile && !busy

  const onDownloadTemplate = async () => {
    setDownloading(true)
    try {
      const { blob, filename } = await downloadProductImportTemplate()
      triggerDownload(blob, filename)
      toast.success('Шаблон скачан')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось скачать шаблон'
      toast.error(message)
    } finally {
      setDownloading(false)
    }
  }

  const onPreview = async () => {
    if (!file || readOnly) return
    setBusy(true)
    setLastImportId(null)
    try {
      const data = await previewProductImport(file, mode)
      setResult(data)
      setPreviewKey(fileKey(file))
      toast.success('Предпросмотр готов')
    } catch (err) {
      setPreviewKey(null)
      setResult(null)
      if (err instanceof ApiError && err.code === 'LOCKED') {
        toast.error('Каталог доступен только для чтения (Google Sheets)')
      } else {
        toast.error(err instanceof Error ? err.message : 'Не удалось выполнить предпросмотр')
      }
    } finally {
      setBusy(false)
    }
  }

  const onCommit = async () => {
    if (!file || !canCommit) return
    const ok = await confirm({
      title: 'Импортировать товары?',
      message:
        mode === 'upsert'
          ? 'Валидные строки будут созданы или обновлены. Пустые ячейки в файле могут обнулить скидку, описание, цвет и размер у существующих артикулов.'
          : 'Валидные строки будут созданы. Строки с ошибками будут пропущены.',
      confirmLabel: 'Импортировать',
    })
    if (!ok) return

    setBusy(true)
    try {
      const data = await commitProductImport(file, mode)
      setResult(data)
      setLastImportId(data.importId ?? null)
      setPreviewKey(null)
      toast.success(
        data.importId != null ? `Импорт завершён (№${data.importId})` : 'Импорт завершён',
      )
      onCommitted()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LOCKED') {
        toast.error('Каталог доступен только для чтения (Google Sheets)')
      } else {
        toast.error(err instanceof Error ? err.message : 'Не удалось импортировать')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Импорт товаров">
      <div className="form-stack">
        <p className="muted-text">
          Чистый шаблон CRM (не Google-реестр). Колонки: {TEMPLATE_COLUMNS}. Категории, фото и
          габариты задаются в карточке товара после импорта.
        </p>
        {mode === 'upsert' ? (
          <p className="muted-text">
            Режим «Создать или обновить»: пустые ячейки в файле могут обнулить скидку, описание, цвет
            и размер у существующего артикула.
          </p>
        ) : null}
        {readOnly ? (
          <p className="muted-text">
            Каталог в режиме Google Sheets — предпросмотр и импорт недоступны. Скачать шаблон можно.
          </p>
        ) : null}

        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            loading={downloading}
            onClick={() => void onDownloadTemplate()}
          >
            Скачать шаблон
          </Button>
        </div>

        <Field label="Режим">
          <Select
            value={mode}
            disabled={readOnly || busy}
            onChange={(e) => {
              setMode(e.target.value as ProductImportMode)
              setPreviewKey(null)
              setResult(null)
              setLastImportId(null)
            }}
          >
            <option value="new">Только новые</option>
            <option value="upsert">Создать или обновить</option>
          </Select>
        </Field>

        <FileDropzone
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          fileName={file?.name ?? null}
          disabled={readOnly || busy}
          onFileSelect={(selected) => {
            setFile(selected)
            setPreviewKey(null)
            setResult(null)
            setLastImportId(null)
          }}
        />

        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            disabled={readOnly || !file}
            onClick={() => void onPreview()}
          >
            Предпросмотр
          </Button>
          <Button
            type="button"
            loading={busy}
            disabled={!canCommit}
            onClick={() => void onCommit()}
          >
            Импортировать
          </Button>
        </div>

        {result ? (
          <div className="form-stack">
            <p>
              Создать: <strong>{result.summary.toCreate}</strong>
              {' · '}
              Обновить: <strong>{result.summary.toUpdate}</strong>
              {' · '}
              Ошибки: <strong>{result.summary.errorRows}</strong>
              {' · '}
              Всего: <strong>{result.summary.total}</strong>
              {lastImportId != null ? (
                <>
                  {' · '}
                  Прогон №{lastImportId}
                </>
              ) : null}
            </p>
            {lastImportId != null ? (
              <p>
                <Link className="muru-page-header__back" to="/catalog/products">
                  Перейти к списку товаров
                </Link>
              </p>
            ) : null}
            <Table>
              <TableHeader sticky>
                <TableRow hover={false}>
                  <TableHead numeric>Строка</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Действие</TableHead>
                  <TableHead>Ошибки</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={`${row.row}-${row.sku}`}>
                    <TableCell numeric>{row.row}</TableCell>
                    <TableCell>{row.sku || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={actionBadgeVariant(row.action)}>
                        {actionLabel(row.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.errors.length > 0
                        ? row.errors.map((e) => e.message).join('; ')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
