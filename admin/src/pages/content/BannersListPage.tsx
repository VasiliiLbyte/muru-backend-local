import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ContentListPage } from '../../components/content/ContentListPage'
import { deleteBanner, listBanners } from '../../lib/content-api'

export const BannersListPage = () => {
  const navigate = useNavigate()
  const [items, setItems] = useState<
    { id: string; title: string; isActive: boolean; updatedAt: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listBanners()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить баннеры')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onDelete = async (id: string) => {
    if (!window.confirm('Удалить баннер?')) return
    try {
      await deleteBanner(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
    }
  }

  return (
    <ContentListPage
      title="Баннеры"
      items={items}
      loading={loading}
      error={error}
      visibilityKey="isActive"
      onCreate={() => navigate('/content/banners/new')}
      onEdit={(id) => navigate(`/content/banners/${id}`)}
      onDelete={onDelete}
    />
  )
}
