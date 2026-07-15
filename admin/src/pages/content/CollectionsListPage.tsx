import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ContentListPage } from '../../components/content/ContentListPage'
import { useConfirm, useToast } from '../../components/ui'
import { deleteCollection, listCollections } from '../../lib/content-api'

export const CollectionsListPage = () => {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const [items, setItems] = useState<
    { id: string; slug: string; title: string; isVisible: boolean; updatedAt: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listCollections()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить коллекции')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Удалить коллекцию?',
      message: 'Запись будет удалена без возможности восстановления.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteCollection(id)
      await load()
      toast.success('Коллекция удалена')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
    }
  }

  return (
    <ContentListPage
      title="Коллекции"
      items={items}
      loading={loading}
      error={error}
      onCreate={() => navigate('/catalog/sections/collections/new')}
      onEdit={(id) => navigate(`/catalog/sections/collections/${id}`)}
      onDelete={onDelete}
    />
  )
}
