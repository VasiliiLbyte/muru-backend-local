import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

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
  const fileRef = useRef<HTMLInputElement>(null)

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось экспортировать каталог')
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
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LOCKED') {
        setError('Каталог доступен только для чтения (Google Sheets)')
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось выполнить предпросмотр')
      }
    } finally {
      setImporting(false)
    }
  }

  const onImport = async () => {
    if (!file || readOnly) return
    if (!window.confirm('Импортировать товары из файла? Данные в CRM будут обновлены.')) return

    setImporting(true)
    setError('')
    setImportSuccess(false)
    try {
      const result = await importCatalog(file, false)
      setReport(result)
      setImportSuccess(true)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LOCKED') {
        setError('Каталог доступен только для чтения (Google Sheets)')
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось импортировать каталог')
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="orders-module">
      <h3 className="content-title">Импорт / Экспорт</h3>
      {error ? <p className="error-text">{error}</p> : null}

      <div className="form-section">
        <h4 className="form-section-title">Экспорт</h4>
        <div className="form-actions">
          <button
            type="button"
            className="primary-button"
            disabled={exporting !== null}
            onClick={() => void onExport('xlsx')}
          >
            {exporting === 'xlsx' ? 'Скачивание…' : 'Скачать XLSX'}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={exporting !== null}
            onClick={() => void onExport('csv')}
          >
            {exporting === 'csv' ? 'Скачивание…' : 'Скачать CSV'}
          </button>
        </div>
      </div>

      {!readOnly ? (
        <div className="form-section">
          <h4 className="form-section-title">Импорт</h4>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setReport(null)
              setImportSuccess(false)
            }}
          />
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={!file || importing}
              onClick={() => void onDryRun()}
            >
              {importing ? 'Обработка…' : 'Предпросмотр (dry-run)'}
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!file || importing}
              onClick={() => void onImport()}
            >
              {importing ? 'Импорт…' : 'Импортировать'}
            </button>
          </div>
        </div>
      ) : null}

      {report ? (
        <div className="form-section">
          <h4 className="form-section-title">Отчёт импорта</h4>
          <p>dryRun: {report.dryRun ? 'да' : 'нет'}</p>
          <p>Строк всего: {report.totalRows}</p>
          <p>Разобрано: {report.parsed}</p>
          <p>Создать: {report.created}</p>
          <p>Обновить: {report.updated}</p>
          <p>Пропущено: {report.skipped}</p>

          {report.errors.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table import-report-table">
                <thead>
                  <tr>
                    <th>Строка</th>
                    <th>SKU</th>
                    <th>Ошибка</th>
                  </tr>
                </thead>
                <tbody>
                  {report.errors.map((err, index) => (
                    <tr key={`${err.row}-${index}`}>
                      <td>{err.row}</td>
                      <td>{err.sku ?? '—'}</td>
                      <td>{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-text">Ошибок нет</p>
          )}

          {importSuccess ? (
            <p>
              Импорт завершён.{' '}
              <Link className="link-button" to="/catalog/products">
                Перейти к списку товаров
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
