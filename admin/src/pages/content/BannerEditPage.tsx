import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ImageUploadField } from '../../components/content/ImageUploadField'
import {
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  PageHeader,
  SkeletonForm,
  useConfirm,
  useToast,
} from '../../components/ui'
import { createBanner, deleteBanner, getBanner, updateBanner } from '../../lib/content-api'
import type { ContentImage } from '../../types/content'
import { datetimeLocalToIso, isoToDatetimeLocal } from '../../utils/datetime'

export const BannerEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const isNew = !id || id === 'new'

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [href, setHref] = useState('')
  const [image, setImage] = useState<ContentImage | null>(null)
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isNew || !id) return

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const item = await getBanner(id)
        setTitle(item.title)
        setSubtitle(item.subtitle ?? '')
        setHref(item.href ?? '')
        setImage(item.image)
        setSortOrder(item.sortOrder)
        setIsActive(item.isActive)
        setStartsAt(isoToDatetimeLocal(item.startsAt))
        setEndsAt(isoToDatetimeLocal(item.endsAt))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить баннер')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, isNew])

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      title,
      subtitle: subtitle || null,
      href: href || null,
      image,
      sortOrder,
      isActive,
      startsAt: datetimeLocalToIso(startsAt),
      endsAt: datetimeLocalToIso(endsAt),
    }

    try {
      if (isNew) {
        const created = await createBanner(payload)
        toast.success('Сохранено')
        navigate(`/content/banners/${created.id}`, { replace: true })
      } else if (id) {
        await updateBanner(id, payload)
        toast.success('Сохранено')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!id || isNew) return
    const ok = await confirm({
      title: 'Удалить баннер?',
      message: 'Запись будет удалена без возможности восстановления.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteBanner(id)
      toast.success('Баннер удалён')
      navigate('/content/banners')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить'
      setError(message)
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <section className="page-stack">
        <SkeletonForm />
      </section>
    )
  }

  return (
    <section className="page-stack">
      <PageHeader
        title={isNew ? 'Новый баннер' : 'Редактирование баннера'}
        backTo="/content/banners"
        backLabel="К списку"
        actions={
          !isNew ? (
            <Button type="button" variant="danger" onClick={() => void onDelete()}>
              Удалить
            </Button>
          ) : undefined
        }
      />

      <form className="form-stack" onSubmit={onSubmit}>
        <Card title="Основное">
          <Field label="Заголовок" htmlFor="title">
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>

          <Field label="Подзаголовок" htmlFor="subtitle">
            <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </Field>

          <Field label="Ссылка" htmlFor="href">
            <Input
              id="href"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/catalog/..."
            />
          </Field>

          <Field label="Порядок сортировки" htmlFor="sortOrder">
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </Field>

          <ImageUploadField label="Изображение" value={image} onChange={setImage} />

          <Field label="Начало показа" htmlFor="startsAt">
            <Input
              id="startsAt"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>

          <Field label="Конец показа" htmlFor="endsAt">
            <Input
              id="endsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>

          <Checkbox
            label="Активен"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </Card>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="form-actions">
          <Button type="submit" loading={saving}>
            Сохранить
          </Button>
        </div>
      </form>
    </section>
  )
}
