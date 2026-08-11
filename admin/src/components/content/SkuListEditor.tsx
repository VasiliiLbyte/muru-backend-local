import { ArrowDown, ArrowUp, Package, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button, EmptyState, Field, IconButton, Input } from '../ui'
import type { CollectionProductInput } from '../../types/content'

type SkuListEditorProps = {
  value: CollectionProductInput[]
  onChange: (value: CollectionProductInput[]) => void
}

type SkuRow = {
  rowId: string
  sku: string
  sortOrder: number
}

const newRowId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `sku-row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const serializeProducts = (items: CollectionProductInput[]): string =>
  items.map((item) => `${item.sku}|${item.sortOrder}`).join('\n')

const hydrateRows = (items: CollectionProductInput[]): SkuRow[] =>
  items.map((item, index) => ({
    rowId: newRowId(),
    sku: item.sku,
    sortOrder: index,
  }))

const toProducts = (rows: SkuRow[]): CollectionProductInput[] =>
  rows.map((row, index) => ({ sku: row.sku, sortOrder: index }))

const normalizeRows = (rows: SkuRow[]): SkuRow[] =>
  rows.map((row, index) => ({ ...row, sortOrder: index }))

export const SkuListEditor = ({ value, onChange }: SkuListEditorProps) => {
  const [rows, setRows] = useState<SkuRow[]>(() => hydrateRows(value))
  const lastEmittedRef = useRef(serializeProducts(value))

  useEffect(() => {
    const incoming = serializeProducts(value)
    if (incoming === lastEmittedRef.current) return
    lastEmittedRef.current = incoming
    setRows(hydrateRows(value))
  }, [value])

  const commit = (next: SkuRow[]) => {
    const normalized = normalizeRows(next)
    setRows(normalized)
    const products = toProducts(normalized)
    lastEmittedRef.current = serializeProducts(products)
    onChange(products)
  }

  const updateItem = (index: number, sku: string) => {
    const next = [...rows]
    next[index] = { ...next[index], sku: sku.toUpperCase() }
    commit(next)
  }

  const addRow = () => {
    commit([...rows, { rowId: newRowId(), sku: '', sortOrder: rows.length }])
  }

  const removeRow = (index: number) => {
    commit(rows.filter((_, i) => i !== index))
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    commit(next)
  }

  return (
    <div className="sku-list-editor">
      {rows.length === 0 ? (
        <EmptyState icon={Package} title="SKU не добавлены" />
      ) : (
        rows.map((item, index) => (
          <div className="sku-list-editor__row" key={item.rowId}>
            <Field
              label={`SKU ${index + 1}`}
              htmlFor={`sku-${item.rowId}`}
              className="sku-list-editor__input"
            >
              <Input
                id={`sku-${item.rowId}`}
                placeholder="MU0001"
                value={item.sku}
                onChange={(e) => updateItem(index, e.target.value)}
              />
            </Field>
            <div className="sku-list-editor__actions">
              <IconButton
                aria-label="Переместить вверх"
                disabled={index === 0}
                onClick={() => moveRow(index, -1)}
              >
                <ArrowUp size={16} />
              </IconButton>
              <IconButton
                aria-label="Переместить вниз"
                disabled={index === rows.length - 1}
                onClick={() => moveRow(index, 1)}
              >
                <ArrowDown size={16} />
              </IconButton>
              <IconButton variant="danger" aria-label="Удалить" onClick={() => removeRow(index)}>
                <Trash2 size={16} />
              </IconButton>
            </div>
          </div>
        ))
      )}
      <Button type="button" variant="secondary" onClick={addRow}>
        Добавить SKU
      </Button>
    </div>
  )
}
