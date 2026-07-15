import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderTree } from 'lucide-react'

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '../../components/ui'
import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { createCategory, listCategories } from '../../lib/catalog-api'
import { categoryCoverPreviewSrc, SALE_CATEGORY_NAME } from '../../lib/category-cover'
import type { CrmCategoryItem } from '../../types/catalog'

const sectionLinks = [
  { to: '/catalog/sections/inspiration', label: 'Вдохновение', hint: 'Лукбуки витрины' },
  { to: '/catalog/sections/collections', label: 'Коллекции', hint: 'Подборки товаров' },
  { to: '/catalog/sections/gift-guide', label: 'Гид по подаркам', hint: 'Товары с флагом gift guide' },
] as const

export const SectionsHubPage = () => {
  const { readOnly } = useCatalogMetaContext()
  const toast = useToast()

  const [items, setItems] = useState<CrmCategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listCategories()
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить категории')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (readOnly || !newName.trim()) return
    setCreating(true)
    setError('')
    try {
      await createCategory({ name: newName.trim() })
      setNewName('')
      await load()
      toast.success('Категория создана')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось создать категорию'
      setError(message)
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="page-stack">
      <PageHeader title="Разделы витрины" />
      {error ? <p className="error-text">{error}</p> : null}

      <Card title="Контентные разделы">
        <div className="section-links-grid">
          {sectionLinks.map((link) => (
            <Link key={link.to} className="section-link-card" to={link.to}>
              <span className="section-link-card__title">{link.label}</span>
              <span className="section-link-card__hint">{link.hint}</span>
            </Link>
          ))}
        </div>
      </Card>

      {!readOnly ? (
        <Card title="Создать категорию">
          <form className="form-stack" onSubmit={onCreate}>
            <Field label="Название" htmlFor="new-category-name">
              <Input
                id="new-category-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название"
                required
              />
            </Field>
            <Button type="submit" loading={creating}>
              Создать
            </Button>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : items.length === 0 ? (
        <EmptyState icon={FolderTree} title="Категории не найдены" />
      ) : (
        <Table>
          <TableHeader sticky>
            <TableRow hover={false}>
              <TableHead>Категория</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead numeric>Товаров</TableHead>
              <TableHead>Обложка</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const isSale = item.name === SALE_CATEGORY_NAME
              const coverSrc = categoryCoverPreviewSrc(item.coverImageUrl)
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link className="muru-page-header__back" to={`/catalog/sections/categories/${item.id}`}>
                      {item.name}
                    </Link>
                    {isSale ? (
                      <Badge variant="neutral" className="inline-badge">
                        виртуальная
                      </Badge>
                    ) : null}
                    {!isSale && item.isUnused ? (
                      <Badge variant="warning" className="inline-badge">
                        не используется
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{item.slug}</TableCell>
                  <TableCell numeric>
                    {item.directProductCount}
                    {item.crossPlacementCount > 0 ? (
                      <Badge variant="neutral" className="inline-badge">
                        +{item.crossPlacementCount} cross
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {coverSrc ? <img src={coverSrc} alt="" className="order-thumb" /> : '—'}
                  </TableCell>
                  <TableCell>
                    <Link className="muru-page-header__back" to={`/catalog/sections/categories/${item.id}`}>
                      {isSale ? 'Просмотр' : 'Управление'}
                    </Link>
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
