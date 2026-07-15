import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ContentListPage } from '../../components/content/ContentListPage'
import { useConfirm, useToast } from '../../components/ui'
import { deletePage, listPages } from '../../lib/content-api'

export const PagesListPage = () => {
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
    const ok = await confirm({
      title: 'Удалить страницу?',
      message: 'Запись будет удалена без возможности восстановления.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deletePage(id)
      await load()
      toast.success('Страница удалена')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
      toast.error(err instanceof Error ? err.message : 'Не удалось удалить')
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
