import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  Button,
  Card,
  FileDropzone,
  PageHeader,
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
import { ApiError } from '../../lib/api'
import { downloadExport, importCatalog } from '../../lib/catalog-api'
import type { CrmCatalogImportResult } from '../../types/catalog'

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const ImportExportPage = () => {
  const { readOnly } = useCatalogMetaContext()
  const confirm = useConfirm()
  const toast = useToast()

  const [file, setFile] = useState<File | null>(null)
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null)
  const [importing, setImporting] = useState(false)
  const [report, setReport] = useState<CrmCatalogImportResult | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [error, setError] = useState('')

  const onExport = async (format: 'xlsx' | 'csv') => {
    setExporting(format)
    setError('')
    try {
      const { blob, filename } = await downloadExport(format)
      triggerDownload(blob, filename)
      toast.success('Экспорт скачан')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось экспортировать каталог'
      setError(message)
      toast.error(message)
    } finally {
      setExporting(null)
    }
  }

  const onDryRun = async () => {
    if (!file || readOnly) return
    setImporting(true)
    setError('')
    setImportSuccess(false)
    try {
      const result = await importCatalog(file, true)
      setReport(result)
      toast.success('Предпросмотр готов')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LOCKED') {
        const message = 'Каталог доступен только для чтения (Google Sheets)'
        setError(message)
        toast.error(message)
      } else {
        const message = err instanceof Error ? err.message : 'Не удалось выполнить предпросмотр'
        setError(message)
        toast.error(message)
      }
    } finally {
      setImporting(false)
    }
  }

  const onImport = async () => {
    if (!file || readOnly) return
    const ok = await confirm({
      title: 'Импортировать товары?',
      message: 'Данные в CRM будут обновлены из выбранного файла.',
      confirmLabel: 'Импортировать',
    })
    if (!ok) return

    setImporting(true)
    setError('')
    setImportSuccess(false)
    try {
      const result = await importCatalog(file, false)
      setReport(result)
      setImportSuccess(true)
      toast.success('Импорт завершён')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LOCKED') {
        const message = 'Каталог доступен только для чтения (Google Sheets)'
        setError(message)
        toast.error(message)
      } else {
        const message = err instanceof Error ? err.message : 'Не удалось импортировать каталог'
        setError(message)
        toast.error(message)
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="page-stack">
      <PageHeader title="Импорт / Экспорт" />
      {error ? <p className="error-text">{error}</p> : null}

      <Card title="Экспорт">
        <div className="form-actions">
          <Button
            type="button"
            loading={exporting === 'xlsx'}
            disabled={exporting !== null}
            onClick={() => void onExport('xlsx')}
          >
            Скачать XLSX
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={exporting === 'csv'}
            disabled={exporting !== null}
            onClick={() => void onExport('csv')}
          >
            Скачать CSV
          </Button>
        </div>
      </Card>

      {!readOnly ? (
        <Card title="Импорт">
          <div className="form-stack">
            <FileDropzone
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              fileName={file?.name ?? null}
              onFileSelect={(selected) => {
                setFile(selected)
                setReport(null)
                setImportSuccess(false)
              }}
            />
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                loading={importing}
                disabled={!file}
                onClick={() => void onDryRun()}
              >
                Предпросмотр (dry-run)
              </Button>
              <Button
                type="button"
                loading={importing}
                disabled={!file}
                onClick={() => void onImport()}
              >
                Импортировать
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {report ? (
        <Card title="Отчёт импорта">
          <div className="form-stack">
            <p>dryRun: {report.dryRun ? 'да' : 'нет'}</p>
            <p>Строк всего: {report.totalRows}</p>
            <p>Разобрано: {report.parsed}</p>
            <p>Создать: {report.created}</p>
            <p>Обновить: {report.updated}</p>
            <p>Пропущено: {report.skipped}</p>

            {report.errors.length > 0 ? (
              <Table>
                <TableHeader sticky>
                  <TableRow hover={false}>
                    <TableHead numeric>Строка</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Ошибка</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.errors.map((err, index) => (
                    <TableRow key={`${err.row}-${index}`}>
                      <TableCell numeric>{err.row}</TableCell>
                      <TableCell>{err.sku ?? '—'}</TableCell>
                      <TableCell>{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="muted-text">Ошибок нет</p>
            )}

            {importSuccess ? (
              <p>
                Импорт завершён.{' '}
                <Link className="muru-page-header__back" to="/catalog/products">
                  Перейти к списку товаров
                </Link>
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </section>
  )
}
