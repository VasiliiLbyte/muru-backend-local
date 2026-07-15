import { useCallback, useEffect, useState } from 'react'
import { List } from 'lucide-react'

import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '../../components/ui'
import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import {
  createCharacteristic,
  listCharacteristics,
  patchCharacteristic,
} from '../../lib/catalog-api'
import type { CrmCharacteristicItem } from '../../types/catalog'

export const CharacteristicsPage = () => {
  const { readOnly } = useCatalogMetaContext()
  const toast = useToast()

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
      toast.success('Характеристика добавлена')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось добавить характеристику'
      setError(message)
      toast.error(message)
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
      toast.success('Сохранено')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось обновить характеристику'
      setError(message)
      toast.error(message)
    }
  }

  return (
    <section className="page-stack">
      <PageHeader title="Характеристики" />
      {error ? <p className="error-text">{error}</p> : null}

      {!readOnly ? (
        <Card title="Добавить">
          <form className="form-stack" onSubmit={onCreate}>
            <Field label="Название" htmlFor="char-name">
              <Input
                id="char-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название"
                required
              />
            </Field>
            <Field label="Порядок" htmlFor="char-sort">
              <Input
                id="char-sort"
                type="number"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={creating}>
              Добавить
            </Button>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <SkeletonTable rows={5} cols={3} />
      ) : items.length === 0 ? (
        <EmptyState icon={List} title="Характеристики не найдены" />
      ) : (
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              <TableHead>Название</TableHead>
              <TableHead numeric>sortOrder</TableHead>
              {!readOnly ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <CharacteristicRow key={item.id} item={item} readOnly={readOnly} onPatch={onPatch} />
            ))}
          </TableBody>
        </Table>
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
      <TableRow hover={false}>
        <TableCell>{item.name}</TableCell>
        <TableCell numeric>{item.sortOrder}</TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow>
      <TableCell>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </TableCell>
      <TableCell numeric>
        <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </TableCell>
      <TableCell>
        <Button type="button" variant="secondary" loading={saving} onClick={() => void onSave()}>
          Сохранить
        </Button>
      </TableCell>
    </TableRow>
  )
}
