import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ContentListPage } from '../../components/content/ContentListPage'
import { deleteCollection, listCollections } from '../../lib/content-api'

export const CollectionsListPage = () => {
  const navigate = useNavigate()
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
    if (!window.confirm('Удалить коллекцию?')) return
    try {
      await deleteCollection(id)
      await load()
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
      onCreate={() => navigate('/content/collections/new')}
      onEdit={(id) => navigate(`/content/collections/${id}`)}
      onDelete={onDelete}
    />
  )
}
