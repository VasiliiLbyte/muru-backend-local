import { FileText, Pencil, Trash2 } from 'lucide-react'

import {
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  SkeletonTable,
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui'
import { VisibilityBadge } from './VisibilityBadge'

export type ContentListItem = {
  id: string
  slug?: string
  title: string
  isVisible?: boolean
  isActive?: boolean
  updatedAt?: string
}

type ContentListPageProps = {
  title: string
  items: ContentListItem[]
  loading: boolean
  error: string
  visibilityKey?: 'isVisible' | 'isActive'
  onCreate: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

const formatDate = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU')
}

export const ContentListPage = ({
  title,
  items,
  loading,
  error,
  visibilityKey = 'isVisible',
  onCreate,
  onEdit,
  onDelete,
}: ContentListPageProps) => {
  if (loading) {
    return (
      <section className="page-stack">
        <PageHeader title={title} />
        <SkeletonTable rows={5} cols={5} />
      </section>
    )
  }

  return (
    <section className="page-stack">
      <PageHeader
        title={title}
        actions={
          <Button type="button" onClick={onCreate}>
            Создать
          </Button>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Пока нет записей"
          action={
            <Button type="button" onClick={onCreate}>
              Создать
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              <TableHead>Slug</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Обновлено</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const visible =
                visibilityKey === 'isActive'
                  ? Boolean(item.isActive)
                  : item.isVisible !== false

              return (
                <TableRow key={item.id}>
                  <TableCell>{item.slug ?? '—'}</TableCell>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>
                    <VisibilityBadge
                      visible={visible}
                      visibleLabel={visibilityKey === 'isActive' ? 'Активен' : 'Видно'}
                      hiddenLabel={visibilityKey === 'isActive' ? 'Неактивен' : 'Скрыто'}
                    />
                  </TableCell>
                  <TableCell>{formatDate(item.updatedAt)}</TableCell>
                  <TableCell>
                    <TableActions>
                      <IconButton
                        aria-label="Редактировать"
                        title="Редактировать"
                        onClick={() => onEdit(item.id)}
                      >
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton
                        variant="danger"
                        aria-label="Удалить"
                        title="Удалить"
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </TableActions>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
