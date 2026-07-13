import { useCallback, useEffect, useState } from 'react'

import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import {
  createCharacteristic,
  listCharacteristics,
  patchCharacteristic,
} from '../../lib/catalog-api'
import type { CrmCharacteristicItem } from '../../types/catalog'

export const CharacteristicsPage = () => {
  const { readOnly } = useCatalogMetaContext()

  const [items, setItems] = useState<CrmCharacteristicItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [newSortOrder, setNewSortOrder] = useState('0')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listCharacteristics()
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить характеристики')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (readOnly || !newName.trim()) return
    setCreating(true)
    setError('')
    try {
      await createCharacteristic({
        name: newName.trim(),
        sortOrder: Number(newSortOrder) || 0,
      })
      setNewName('')
      setNewSortOrder('0')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить характеристику')
    } finally {
      setCreating(false)
    }
  }

  const onPatch = async (id: number, patch: { name?: string; sortOrder?: number }) => {
    if (readOnly) return
    setError('')
    try {
      await patchCharacteristic(id, patch)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить характеристику')
    }
  }

  return (
    <section className="orders-module">
      <h3 className="content-title">Характеристики</h3>
      {error ? <p className="error-text">{error}</p> : null}

      {!readOnly ? (
        <form className="form-section" onSubmit={onCreate}>
          <h4 className="form-section-title">Добавить</h4>
          <input
            className="field-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название"
            required
          />
          <input
            className="field-input"
            type="number"
            value={newSortOrder}
            onChange={(e) => setNewSortOrder(e.target.value)}
            placeholder="sortOrder"
          />
          <button type="submit" className="primary-button" disabled={creating}>
            {creating ? 'Добавление…' : 'Добавить'}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="muted-text">Загрузка...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>sortOrder</th>
                {!readOnly ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <CharacteristicRow
                  key={item.id}
                  item={item}
                  readOnly={readOnly}
                  onPatch={onPatch}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const CharacteristicRow = ({
  item,
  readOnly,
  onPatch,
}: {
  item: CrmCharacteristicItem
  readOnly: boolean
  onPatch: (id: number, patch: { name?: string; sortOrder?: number }) => Promise<void>
}) => {
  const [name, setName] = useState(item.name)
  const [sortOrder, setSortOrder] = useState(String(item.sortOrder))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(item.name)
    setSortOrder(String(item.sortOrder))
  }, [item.name, item.sortOrder])

  const onSave = async () => {
    setSaving(true)
    await onPatch(item.id, {
      name: name.trim(),
      sortOrder: Number(sortOrder) || 0,
    })
    setSaving(false)
  }

  if (readOnly) {
    return (
      <tr>
        <td>{item.name}</td>
        <td>{item.sortOrder}</td>
      </tr>
    )
  }

  return (
    <tr>
      <td>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td>
        <input
          className="field-input"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
      </td>
      <td>
        <button type="button" className="secondary-button" disabled={saving} onClick={() => void onSave()}>
          {saving ? '…' : 'Сохранить'}
        </button>
      </td>
    </tr>
  )
}
