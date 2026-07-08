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
    return <p className="muted-text">Загрузка...</p>
  }

  return (
    <section className="content-list">
      <div className="content-list-header">
        <h3 className="content-list-title">{title}</h3>
        <button type="button" className="primary-button" onClick={onCreate}>
          Создать
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Название</th>
              <th>Статус</th>
              <th>Обновлено</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted-text">
                  Пока нет записей
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const visible =
                  visibilityKey === 'isActive'
                    ? Boolean(item.isActive)
                    : item.isVisible !== false

                return (
                  <tr key={item.id}>
                    <td>{item.slug ?? '—'}</td>
                    <td>{item.title}</td>
                    <td>
                      <VisibilityBadge
                        visible={visible}
                        visibleLabel={visibilityKey === 'isActive' ? 'Активен' : 'Видно'}
                        hiddenLabel={visibilityKey === 'isActive' ? 'Неактивен' : 'Скрыто'}
                      />
                    </td>
                    <td>{formatDate(item.updatedAt)}</td>
                    <td className="table-actions">
                      <button type="button" className="link-button" onClick={() => onEdit(item.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="link-button link-button-danger"
                        onClick={() => onDelete(item.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
