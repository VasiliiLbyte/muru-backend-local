import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ContentListPage } from '../../components/content/ContentListPage'
import { useConfirm, useToast } from '../../components/ui'
import { deleteBanner, listBanners } from '../../lib/content-api'

export const BannersListPage = () => {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
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
    const ok = await confirm({
      title: 'Удалить баннер?',
      message: 'Запись будет удалена без возможности восстановления.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteBanner(id)
      await load()
      toast.success('Баннер удалён')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
      toast.error(err instanceof Error ? err.message : 'Не удалось удалить')
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
