import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ImageUploadField } from '../../components/content/ImageUploadField'
import {
  Button,
  Card,
  Checkbox,
  Field,
  FileDropzone,
  Input,
  PageHeader,
  SkeletonForm,
  useConfirm,
  useToast,
} from '../../components/ui'
import { createBanner, deleteBanner, getBanner, updateBanner, uploadVideo } from '../../lib/content-api'
import type { ContentImage, ContentVideo } from '../../types/content'
import { datetimeLocalToIso, isoToDatetimeLocal } from '../../utils/datetime'

const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm'

type MediaMode = 'photo' | 'video'

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
  const [video, setVideo] = useState<ContentVideo | null>(null)
  const [mediaMode, setMediaMode] = useState<MediaMode>('photo')
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [error, setError] = useState('')
  const [videoError, setVideoError] = useState('')

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
        setVideo(item.video ?? null)
        setMediaMode(item.video ? 'video' : 'photo')
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

  const onPhotoChange = (next: ContentImage | null) => {
    setImage(next)
    setVideo(null)
  }

  const onVideoFile = async (file: File) => {
    setVideoError('')
    if (file.size > MAX_VIDEO_BYTES) {
      const message = 'Файл больше 50 МБ. Сожмите видео или уменьшите разрешение.'
      setVideoError(message)
      toast.error(message)
      return
    }

    setUploadingVideo(true)
    try {
      const result = await uploadVideo(file)
      setVideo(result.video)
      setImage(result.image)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить видео'
      setVideoError(message)
      toast.error(message)
    } finally {
      setUploadingVideo(false)
    }
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      title,
      subtitle: subtitle || null,
      href: href || null,
      image,
      video,
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

          <div className="banner-media">
            <span className="muru-field__label">Медиа</span>
            <div className="banner-media__mode" role="group" aria-label="Тип медиа">
              <Button
                type="button"
                variant={mediaMode === 'photo' ? 'primary' : 'secondary'}
                onClick={() => setMediaMode('photo')}
              >
                Фото
              </Button>
              <Button
                type="button"
                variant={mediaMode === 'video' ? 'primary' : 'secondary'}
                onClick={() => setMediaMode('video')}
              >
                Видео
              </Button>
            </div>

            {mediaMode === 'photo' ? (
              <ImageUploadField label="Изображение" value={image} onChange={onPhotoChange} />
            ) : (
              <div className="banner-media__video">
                <p className="muted-text">до 50 МБ, до 30 с · MP4, MOV или WebM</p>
                <FileDropzone
                  label="Видеофайл"
                  accept={VIDEO_ACCEPT}
                  fileName={video?.url ? video.url.split('/').pop() : null}
                  disabled={uploadingVideo}
                  onFileSelect={(file) => void onVideoFile(file)}
                />
                {uploadingVideo ? <p className="muted-text">Загрузка и сжатие…</p> : null}
                {videoError ? <p className="error-text">{videoError}</p> : null}
                {video ? (
                  <>
                    <video
                      className="banner-media__preview"
                      src={video.url}
                      poster={image?.url}
                      muted
                      controls
                      playsInline
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setVideo(null)
                        setVideoError('')
                      }}
                    >
                      Убрать видео (постер останется)
                    </Button>
                  </>
                ) : null}
              </div>
            )}
          </div>

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
