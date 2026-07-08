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
    <fieldset className="form-section">
      <legend className="form-section-title">Товары (SKU)</legend>
      <div className="sku-list">
        {value.length === 0 ? <p className="muted-text">SKU не добавлены</p> : null}
        {value.map((item, index) => (
          <div className="sku-row" key={`${index}-${item.sku}`}>
            <input
              className="field-input"
              placeholder="MU0001"
              value={item.sku}
              onChange={(e) => updateItem(index, e.target.value)}
            />
            <div className="sku-row-actions">
              <button type="button" className="secondary-button" onClick={() => moveRow(index, -1)}>
                ↑
              </button>
              <button type="button" className="secondary-button" onClick={() => moveRow(index, 1)}>
                ↓
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => removeRow(index)}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="secondary-button" onClick={addRow}>
        Добавить SKU
      </button>
    </fieldset>
  )
}
