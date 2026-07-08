import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ContentListPage } from '../../components/content/ContentListPage'
import { deletePage, listPages } from '../../lib/content-api'

export const PagesListPage = () => {
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
      const data = await listPages()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить страницы')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onDelete = async (id: string) => {
    if (!window.confirm('Удалить страницу?')) return
    try {
      await deletePage(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
    }
  }

  return (
    <ContentListPage
      title="Страницы"
      items={items}
      loading={loading}
      error={error}
      onCreate={() => navigate('/content/pages/new')}
      onEdit={(id) => navigate(`/content/pages/${id}`)}
      onDelete={onDelete}
    />
  )
}
