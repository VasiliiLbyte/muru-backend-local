import { ArrowDown, ArrowUp, Package, Trash2 } from 'lucide-react'

import { Button, EmptyState, Field, IconButton, Input } from '../ui'
import type { CollectionProductInput } from '../../types/content'

type SkuListEditorProps = {
  value: CollectionProductInput[]
  onChange: (value: CollectionProductInput[]) => void
}

const normalizeSortOrders = (items: CollectionProductInput[]): CollectionProductInput[] =>
  items.map((item, index) => ({ ...item, sortOrder: index }))

export const SkuListEditor = ({ value, onChange }: SkuListEditorProps) => {
  const updateItem = (index: number, sku: string) => {
    const next = [...value]
    next[index] = { ...next[index], sku: sku.toUpperCase() }
    onChange(next)
  }

  const addRow = () => {
    onChange(normalizeSortOrders([...value, { sku: '', sortOrder: value.length }]))
  }

  const removeRow = (index: number) => {
    onChange(normalizeSortOrders(value.filter((_, i) => i !== index)))
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(normalizeSortOrders(next))
  }

  return (
    <div className="sku-list-editor">
      {value.length === 0 ? (
        <EmptyState icon={Package} title="SKU не добавлены" />
      ) : (
        value.map((item, index) => (
          <div className="sku-list-editor__row" key={`${index}-${item.sku}`}>
            <Field label={`SKU ${index + 1}`} htmlFor={`sku-${index}`} className="sku-list-editor__input">
              <Input
                id={`sku-${index}`}
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
                disabled={index === value.length - 1}
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
