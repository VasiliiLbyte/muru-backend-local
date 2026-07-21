import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Star } from 'lucide-react'

import { ProductImagesEditor } from '../../components/catalog/ProductImagesEditor'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  IconButton,
  Input,
  PageHeader,
  Select,
  SkeletonForm,
  Textarea,
  useToast,
} from '../../components/ui'
import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { ApiError } from '../../lib/api'
import { buildProxiedImageUrl } from '../../lib/images'
import {
  archiveProduct,
  createProduct,
  getProduct,
  listCategories,
  patchProduct,
  unarchiveProduct,
  updateProductStock,
} from '../../lib/catalog-api'
import { listCollections } from '../../lib/content-api'
import {
  getProductCollections,
  putProductCollections,
} from '../../lib/product-collections-api'
import type { CrmCatalogProductDetail, CrmCategoryItem, ProductImageSlot } from '../../types/catalog'
import type { CrmCollectionDto } from '../../types/content'

const MANAGED_SPEC_KEYS = [
  'Материал',
  'Цвет',
  'Бренд',
  'Страна производитель',
  'Страна',
  'Размер',
  'Тип',
] as const

const productToImageSlots = (product: CrmCatalogProductDetail): ProductImageSlot[] =>
  (product.imageUrls ?? []).map((url) => {
    const proxyPath = buildProxiedImageUrl(url) ?? undefined
    return proxyPath ? { url, proxyPath } : { url }
  })

export const ProductEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'
  const productId = isNew ? null : Number(id)

  const { readOnly } = useCatalogMetaContext()
  const toast = useToast()

  const [product, setProduct] = useState<CrmCatalogProductDetail | null>(null)
  const [categories, setCategories] = useState<CrmCategoryItem[]>([])
  const [collections, setCollections] = useState<CrmCollectionDto[]>([])

  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [discountPercent, setDiscountPercent] = useState('0')
  const [inStock, setInStock] = useState('0')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryIds, setSubcategoryIds] = useState<number[]>([])
  const [collectionIds, setCollectionIds] = useState<number[]>([])
  const [material, setMaterial] = useState('')
  const [colorField, setColorField] = useState('')
  const [country, setCountry] = useState('')
  const [sizeField, setSizeField] = useState('')
  const [brand, setBrand] = useState('')
  const [isGiftGuide, setIsGiftGuide] = useState(false)
  const [isNewArrival, setIsNewArrival] = useState(false)
  const [newArrivalAt, setNewArrivalAt] = useState<string | null>(null)
  const [imageSlots, setImageSlots] = useState<ProductImageSlot[]>([])
  const [weightGrams, setWeightGrams] = useState('')
  const [dimLengthCm, setDimLengthCm] = useState('')
  const [dimWidthCm, setDimWidthCm] = useState('')
  const [dimHeightCm, setDimHeightCm] = useState('')
  const [dimensionsLabel, setDimensionsLabel] = useState('')

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [savingStock, setSavingStock] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState('')

  const subcategoryOptions = categories.flatMap((cat) =>
    cat.subcategories.map((sub) => ({
      id: sub.id,
      name: sub.name,
      label: `${cat.name} / ${sub.name}`,
      categoryName: cat.name,
    })),
  )

  const primarySubcategoryName = useMemo(() => {
    const primaryId = subcategoryIds[0]
    if (primaryId == null) return null
    return subcategoryOptions.find((opt) => opt.id === primaryId)?.name ?? null
  }, [subcategoryIds, subcategoryOptions])

  const toggleSubcategory = (subId: number) => {
    setSubcategoryIds((prev) =>
      prev.includes(subId) ? prev.filter((x) => x !== subId) : [...prev, subId],
    )
  }

  const toggleCollection = (collectionId: number) => {
    setCollectionIds((prev) =>
      prev.includes(collectionId)
        ? prev.filter((x) => x !== collectionId)
        : [...prev, collectionId],
    )
  }

  const moveSelectedSubcategory = (index: number, direction: -1 | 1) => {
    setSubcategoryIds((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const applyProductToForm = useCallback((data: CrmCatalogProductDetail) => {
    const specs = data.specs ?? {}
    setSku(data.sku)
    setName(data.name)
    setDescription(data.description ?? '')
    setPrice(String(data.price))
    setDiscountPercent(String(data.discountPercent))
    setInStock(String(data.inStock))
    setCategoryId(data.categoryId != null ? String(data.categoryId) : '')
    setSubcategoryIds(data.subcategoryIds ?? [])
    setMaterial(specs['Материал'] ?? '')
    setColorField(specs['Цвет'] ?? data.color ?? '')
    setCountry(specs['Страна производитель'] ?? specs['Страна'] ?? '')
    setSizeField(specs['Размер'] ?? data.size ?? '')
    setBrand(specs['Бренд'] ?? '')
    setIsGiftGuide(data.isGiftGuide ?? false)
    setIsNewArrival(data.isNewArrival ?? false)
    setNewArrivalAt(data.newArrivalAt ?? null)
    setImageSlots(productToImageSlots(data))
    setWeightGrams(String(data.weightGrams))
    setDimLengthCm(String(data.dimLengthCm))
    setDimWidthCm(String(data.dimWidthCm))
    setDimHeightCm(String(data.dimHeightCm))
    setDimensionsLabel(data.dimensionsLabel ?? '')
  }, [])

  useEffect(() => {
    void listCategories()
      .then((cats) => setCategories(cats.items))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    void listCollections()
      .then(setCollections)
      .catch(() => setCollections([]))
  }, [])

  const load = useCallback(async () => {
    if (isNew) {
      setCollectionIds([])
      setLoading(false)
      return
    }

    if (!Number.isInteger(productId) || productId! <= 0) {
      setError('Некорректный ID товара')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const data = await getProduct(productId!)
      setProduct(data)
      applyProductToForm(data)
      try {
        const membership = await getProductCollections(data.sku)
        setCollectionIds(membership.collectionIds)
      } catch (membershipErr) {
        setCollectionIds([])
        toast.error(
          membershipErr instanceof Error
            ? membershipErr.message
            : 'Не удалось загрузить коллекции товара',
        )
      }
    } catch (err) {
      setProduct(null)
      setError(err instanceof Error ? err.message : 'Не удалось загрузить товар')
    } finally {
      setLoading(false)
    }
  }, [isNew, productId, applyProductToForm, toast])

  useEffect(() => {
    void load()
  }, [load])

  const buildSpecs = (): Record<string, string> => {
    const base = { ...(product?.specs ?? {}) }
    for (const key of MANAGED_SPEC_KEYS) {
      delete base[key]
    }

    const trimmedMaterial = material.trim()
    const trimmedColor = colorField.trim()
    const trimmedCountry = country.trim()
    const trimmedSize = sizeField.trim()
    const trimmedBrand = brand.trim()

    if (trimmedMaterial) base['Материал'] = trimmedMaterial
    if (trimmedColor) base['Цвет'] = trimmedColor
    if (trimmedCountry) base['Страна производитель'] = trimmedCountry
    if (trimmedSize) base['Размер'] = trimmedSize
    if (trimmedBrand) base['Бренд'] = trimmedBrand
    if (primarySubcategoryName) base['Тип'] = primarySubcategoryName

    return base
  }

  const buildBody = () => {
    const imageUrls = imageSlots.map((s) => s.url)
    const trimmedColor = colorField.trim()
    const trimmedSize = sizeField.trim()
    return {
      name: name.trim(),
      description,
      price: Number(price) || 0,
      discountPercent: Number(discountPercent) || 0,
      inStock: Number(inStock) || 0,
      categoryId: categoryId ? Number(categoryId) : null,
      subcategoryIds,
      specs: buildSpecs(),
      color: trimmedColor || null,
      size: trimmedSize || null,
      isGiftGuide,
      isNewArrival,
      imageUrls,
      imageUrl1: imageUrls[0],
      imageUrl2: imageUrls[1] ?? imageUrls[0],
      weightGrams: Number(weightGrams) || undefined,
      dimLengthCm: Number(dimLengthCm) || undefined,
      dimWidthCm: Number(dimWidthCm) || undefined,
      dimHeightCm: Number(dimHeightCm) || undefined,
      dimensionsLabel: dimensionsLabel.trim(),
    }
  }

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (readOnly) return

    setSaving(true)
    setError('')
    try {
      if (isNew) {
        const created = await createProduct({
          sku: sku.trim(),
          ...buildBody(),
        })
        try {
          await putProductCollections(created.sku, collectionIds)
        } catch (membershipErr) {
          toast.error(
            membershipErr instanceof Error
              ? membershipErr.message
              : 'Товар сохранён, но коллекции не обновлены',
          )
        }
        toast.success('Сохранено')
        navigate(`/catalog/products/${created.id}`, { replace: true })
        return
      }

      const updated = await patchProduct(productId!, buildBody())
      setProduct(updated)
      applyProductToForm(updated)
      try {
        await putProductCollections(updated.sku || sku.trim(), collectionIds)
      } catch (membershipErr) {
        toast.error(
          membershipErr instanceof Error
            ? membershipErr.message
            : 'Товар сохранён, но коллекции не обновлены',
        )
      }
      toast.success('Сохранено')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LOCKED') {
        const message = 'Каталог доступен только для чтения (Google Sheets)'
        setError(message)
        toast.error(message)
      } else {
        const message = err instanceof Error ? err.message : 'Не удалось сохранить'
        setError(message)
        toast.error(message)
      }
    } finally {
      setSaving(false)
    }
  }

  const onSaveStock = async () => {
    if (readOnly || isNew || !productId) return
    setSavingStock(true)
    setError('')
    try {
      const updated = await updateProductStock(productId, Number(inStock) || 0)
      setProduct(updated)
      applyProductToForm(updated)
      toast.success('Сохранено')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить остаток'
      setError(message)
      toast.error(message)
    } finally {
      setSavingStock(false)
    }
  }

  const onToggleArchive = async () => {
    if (readOnly || isNew || !product) return
    setArchiving(true)
    setError('')
    try {
      const updated = product.isArchived
        ? await unarchiveProduct(product.id)
        : await archiveProduct(product.id)
      setProduct(updated)
      applyProductToForm(updated)
      toast.success('Сохранено')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось изменить статус архива'
      setError(message)
      toast.error(message)
    } finally {
      setArchiving(false)
    }
  }

  if (loading) {
    return (
      <section className="page-stack">
        <SkeletonForm />
      </section>
    )
  }

  if (!isNew && !product) {
    return (
      <section className="page-stack">
        <p className="error-text">{error || 'Товар не найден'}</p>
        <Link className="muru-page-header__back" to="/catalog/products">
          К списку
        </Link>
      </section>
    )
  }

  const pageTitle = isNew ? 'Новый товар' : name || product?.sku || 'Товар'

  return (
    <section className="page-stack">
      <PageHeader
        title={pageTitle}
        backTo="/catalog/products"
        backLabel="К списку"
        actions={
          !isNew && !readOnly ? (
            <Button
              type="button"
              variant="danger"
              loading={archiving}
              onClick={() => void onToggleArchive()}
            >
              {product?.isArchived ? 'Разархивировать' : 'Архивировать'}
            </Button>
          ) : undefined
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      {!isNew && product?.isArchived ? (
        <Badge variant="neutral">Архив</Badge>
      ) : null}

      <form className="form-stack" onSubmit={onSave}>
        <Card title="Основное">
          {isNew ? (
            <Field label="SKU" htmlFor="product-sku">
              <Input
                id="product-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={readOnly}
                required
              />
            </Field>
          ) : (
            <p className="muted-text">SKU: {product?.sku}</p>
          )}

          <Field label="Название" htmlFor="product-name">
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={readOnly}
              required
            />
          </Field>

          <Field label="Описание" htmlFor="product-description">
            <Textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Цена" htmlFor="product-price">
            <Input
              id="product-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Скидка (%)" htmlFor="product-discount">
            <Input
              id="product-discount"
              type="number"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Остаток" htmlFor="product-stock">
            <Input
              id="product-stock"
              type="number"
              min="0"
              value={inStock}
              onChange={(e) => setInStock(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          {!isNew && !readOnly ? (
            <Button
              type="button"
              variant="secondary"
              loading={savingStock}
              onClick={() => void onSaveStock()}
            >
              Сохранить остаток
            </Button>
          ) : null}

          <Checkbox
            label="Гид по подаркам"
            checked={isGiftGuide}
            onChange={(e) => setIsGiftGuide(e.target.checked)}
            disabled={readOnly}
          />

          <Checkbox
            label="Добавить в новинки"
            checked={isNewArrival}
            onChange={(e) => setIsNewArrival(e.target.checked)}
            disabled={readOnly}
          />
          {isNewArrival && newArrivalAt ? (
            <p className="muted-text">
              Дата:{' '}
              {new Date(newArrivalAt).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          ) : null}
        </Card>

        <Card title="Категория">
          <Field label="Категория" htmlFor="product-category">
            <Select
              id="product-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={readOnly}
            >
              <option value="">—</option>
              {categories
                .filter((cat) => cat.name !== 'Распродажа')
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </Select>
          </Field>

          <p className="muted-text">Первая выбранная — основная (write-through в каталог).</p>

          <div className="catalog-subcategory-picker">
            {categories
              .filter((cat) => cat.subcategories.length > 0)
              .map((cat) => (
                <Card key={cat.id} title={cat.name}>
                  {cat.subcategories.map((sub) => (
                    <Checkbox
                      key={sub.id}
                      label={sub.name}
                      checked={subcategoryIds.includes(sub.id)}
                      onChange={() => toggleSubcategory(sub.id)}
                      disabled={readOnly}
                    />
                  ))}
                </Card>
              ))}
          </div>

          {subcategoryIds.length > 0 ? (
            <Card title="Порядок подкатегорий">
              <ul className="catalog-subcategory-order">
                {subcategoryIds.map((subId, index) => {
                  const opt = subcategoryOptions.find((o) => o.id === subId)
                  return (
                    <li key={subId} className="catalog-subcategory-order__row">
                      <span className="catalog-subcategory-order__label">
                        {index === 0 ? (
                          <Star size={14} className="catalog-subcategory-order__star" aria-hidden />
                        ) : null}
                        {opt?.label ?? `ID ${subId}`}
                      </span>
                      {!readOnly ? (
                        <span className="catalog-subcategory-order__actions">
                          <IconButton
                            aria-label="Переместить вверх"
                            disabled={index === 0}
                            onClick={() => moveSelectedSubcategory(index, -1)}
                          >
                            <ArrowUp size={16} />
                          </IconButton>
                          <IconButton
                            aria-label="Переместить вниз"
                            disabled={index === subcategoryIds.length - 1}
                            onClick={() => moveSelectedSubcategory(index, 1)}
                          >
                            <ArrowDown size={16} />
                          </IconButton>
                        </span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </Card>
          ) : null}
        </Card>

        <Card title="Коллекции">
          {collections.length === 0 ? (
            <p className="muted-text">Коллекций пока нет</p>
          ) : (
            collections.map((col) => {
              const idNum = Number(col.id)
              return (
                <Checkbox
                  key={col.id}
                  label={col.title}
                  checked={Number.isInteger(idNum) && collectionIds.includes(idNum)}
                  onChange={() => {
                    if (!Number.isInteger(idNum) || idNum <= 0) return
                    toggleCollection(idNum)
                  }}
                  disabled={readOnly || !Number.isInteger(idNum) || idNum <= 0}
                />
              )
            })
          )}
        </Card>

        <Card title="Фото">
          <ProductImagesEditor value={imageSlots} onChange={setImageSlots} disabled={readOnly} />
        </Card>

        <Card title="Характеристики">
          <Field label="Материал" htmlFor="product-material">
            <Input
              id="product-material"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Цвет" htmlFor="product-color">
            <Input
              id="product-color"
              value={colorField}
              onChange={(e) => setColorField(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Страна производитель" htmlFor="product-country">
            <Input
              id="product-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Размер" htmlFor="product-size">
            <Input
              id="product-size"
              value={sizeField}
              onChange={(e) => setSizeField(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Бренд" htmlFor="product-brand">
            <Input
              id="product-brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Тип">
            <p className="muted-text">{primarySubcategoryName ?? '—'}</p>
            <p className="muted-text">
              Заполняется автоматически из основной подкатегории при сохранении.
            </p>
          </Field>
        </Card>

        <Card title="Габариты">
          <p className="muted-text">
            Ручной ввод габаритов/веса сохраняется на бэкенде как source: manual.
          </p>

          <Field label="Вес (г)" htmlFor="product-weight">
            <Input
              id="product-weight"
              type="number"
              min="1"
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Длина (см)" htmlFor="product-dim-l">
            <Input
              id="product-dim-l"
              type="number"
              min="1"
              value={dimLengthCm}
              onChange={(e) => setDimLengthCm(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Ширина (см)" htmlFor="product-dim-w">
            <Input
              id="product-dim-w"
              type="number"
              min="1"
              value={dimWidthCm}
              onChange={(e) => setDimWidthCm(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Высота (см)" htmlFor="product-dim-h">
            <Input
              id="product-dim-h"
              type="number"
              min="1"
              value={dimHeightCm}
              onChange={(e) => setDimHeightCm(e.target.value)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Размер (label)" htmlFor="product-dims-label">
            <Input
              id="product-dims-label"
              value={dimensionsLabel}
              onChange={(e) => setDimensionsLabel(e.target.value)}
              disabled={readOnly}
            />
          </Field>
        </Card>

        {!readOnly ? (
          <div className="form-actions">
            <Button type="submit" loading={saving}>
              Сохранить
            </Button>
          </div>
        ) : null}
      </form>
    </section>
  )
}
