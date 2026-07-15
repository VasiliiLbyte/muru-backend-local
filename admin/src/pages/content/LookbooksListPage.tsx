import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ContentListPage } from '../../components/content/ContentListPage'
import { deleteLookbook, listLookbooks } from '../../lib/content-api'

export const LookbooksListPage = () => {
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
      const data = await listLookbooks()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить лукбуки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onDelete = async (id: string) => {
    if (!window.confirm('Удалить лукбук?')) return
    try {
      await deleteLookbook(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
    }
  }

  return (
    <ContentListPage
      title="Вдохновение"
      items={items}
      loading={loading}
      error={error}
      onCreate={() => navigate('/catalog/sections/inspiration/new')}
      onEdit={(id) => navigate(`/catalog/sections/inspiration/${id}`)}
      onDelete={onDelete}
    />
  )
}
