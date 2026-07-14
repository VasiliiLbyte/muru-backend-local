import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ProductImagesEditor } from '../../components/catalog/ProductImagesEditor'
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
import type { CrmCatalogProductDetail, CrmCategoryItem, ProductImageSlot } from '../../types/catalog'

const MANAGED_SPEC_KEYS = [
  'Материал',
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

  const [product, setProduct] = useState<CrmCatalogProductDetail | null>(null)
  const [categories, setCategories] = useState<CrmCategoryItem[]>([])

  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [discountPercent, setDiscountPercent] = useState('0')
  const [inStock, setInStock] = useState('0')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryIds, setSubcategoryIds] = useState<number[]>([])
  const [material, setMaterial] = useState('')
  const [country, setCountry] = useState('')
  const [sizeField, setSizeField] = useState('')
  const [brand, setBrand] = useState('')
  const [isGiftGuide, setIsGiftGuide] = useState(false)
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
    setCountry(specs['Страна производитель'] ?? specs['Страна'] ?? '')
    setSizeField(specs['Размер'] ?? data.size ?? '')
    setBrand(specs['Бренд'] ?? '')
    setIsGiftGuide(data.isGiftGuide ?? false)
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

  const load = useCallback(async () => {
    if (isNew) {
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
    } catch (err) {
      setProduct(null)
      setError(err instanceof Error ? err.message : 'Не удалось загрузить товар')
    } finally {
      setLoading(false)
    }
  }, [isNew, productId, applyProductToForm])

  useEffect(() => {
    void load()
  }, [load])

  const buildSpecs = (): Record<string, string> => {
    const base = { ...(product?.specs ?? {}) }
    for (const key of MANAGED_SPEC_KEYS) {
      delete base[key]
    }

    const trimmedMaterial = material.trim()
    const trimmedCountry = country.trim()
    const trimmedSize = sizeField.trim()
    const trimmedBrand = brand.trim()

    if (trimmedMaterial) base['Материал'] = trimmedMaterial
    if (trimmedCountry) base['Страна производитель'] = trimmedCountry
    if (trimmedSize) base['Размер'] = trimmedSize
    if (trimmedBrand) base['Бренд'] = trimmedBrand
    if (primarySubcategoryName) base['Тип'] = primarySubcategoryName

    return base
  }

  const buildBody = () => {
    const imageUrls = imageSlots.map((s) => s.url)
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
      size: trimmedSize || null,
      isGiftGuide,
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
        navigate(`/catalog/products/${created.id}`, { replace: true })
        return
      }

      const updated = await patchProduct(productId!, buildBody())
      setProduct(updated)
      applyProductToForm(updated)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LOCKED') {
        setError('Каталог доступен только для чтения (Google Sheets)')
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось сохранить')
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить остаток')
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить статус архива')
    } finally {
      setArchiving(false)
    }
  }

  if (loading) {
    return <p className="muted-text">Загрузка...</p>
  }

  if (!isNew && !product) {
    return (
      <section className="orders-module">
        <p className="error-text">{error || 'Товар не найден'}</p>
        <Link className="link-button" to="/catalog/products">
          ← К списку
        </Link>
      </section>
    )
  }

  return (
    <section className="orders-module">
      <div className="content-form-header">
        <h3 className="content-title">{isNew ? 'Новый товар' : `Товар ${product?.sku}`}</h3>
        <Link className="link-button" to="/catalog/products">
          ← К списку
        </Link>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {!isNew && product?.isArchived ? (
        <p>
          <span className="badge badge-hidden">Архив</span>
        </p>
      ) : null}

      <form onSubmit={onSave}>
        <div className="form-section">
          <h4 className="form-section-title">Основное</h4>
          {isNew ? (
            <>
              <label className="field-label" htmlFor="product-sku">
                SKU
              </label>
              <input
                id="product-sku"
                className="field-input"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={readOnly}
                required
              />
            </>
          ) : (
            <p className="muted-text">SKU: {product?.sku}</p>
          )}

          <label className="field-label" htmlFor="product-name">
            Название
          </label>
          <input
            id="product-name"
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={readOnly}
            required
          />

          <label className="field-label" htmlFor="product-description">
            Описание
          </label>
          <textarea
            id="product-description"
            className="field-input field-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={readOnly}
          />

          <label className="field-label" htmlFor="product-price">
            Цена
          </label>
          <input
            id="product-price"
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={readOnly}
          />

          <label className="field-label" htmlFor="product-discount">
            Скидка (%)
          </label>
          <input
            id="product-discount"
            className="field-input"
            type="number"
            min="0"
            max="100"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            disabled={readOnly}
          />

          <label className="field-label" htmlFor="product-stock">
            Остаток
          </label>
          <input
            id="product-stock"
            className="field-input"
            type="number"
            min="0"
            value={inStock}
            onChange={(e) => setInStock(e.target.value)}
            disabled={readOnly}
          />
          {!isNew && !readOnly ? (
            <button
              type="button"
              className="secondary-button"
              disabled={savingStock}
              onClick={() => void onSaveStock()}
            >
              {savingStock ? 'Сохранение…' : 'Сохранить остаток'}
            </button>
          ) : null}

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isGiftGuide}
              onChange={(e) => setIsGiftGuide(e.target.checked)}
              disabled={readOnly}
            />
            Гид по подаркам
          </label>
        </div>

        <div className="form-section">
          <h4 className="form-section-title">Категория</h4>
          <label className="field-label" htmlFor="product-category">
            Категория
          </label>
          <select
            id="product-category"
            className="field-input"
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
          </select>

          <label className="field-label">Подкатегории</label>
          <p className="muted-text">Первая выбранная — основная (write-through в каталог).</p>
          <div className="catalog-subcategory-picker">
            {subcategoryOptions.map((opt) => (
              <label key={opt.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={subcategoryIds.includes(opt.id)}
                  onChange={() => toggleSubcategory(opt.id)}
                  disabled={readOnly}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {subcategoryIds.length > 0 ? (
            <ul className="catalog-subcategory-order">
              {subcategoryIds.map((subId, index) => {
                const opt = subcategoryOptions.find((o) => o.id === subId)
                return (
                  <li key={subId}>
                    {index === 0 ? '★ ' : ''}
                    {opt?.label ?? `ID ${subId}`}
                    {!readOnly ? (
                      <>
                        <button
                          type="button"
                          className="link-button"
                          disabled={index === 0}
                          onClick={() => moveSelectedSubcategory(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="link-button"
                          disabled={index === subcategoryIds.length - 1}
                          onClick={() => moveSelectedSubcategory(index, 1)}
                        >
                          ↓
                        </button>
                      </>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>

        <div className="form-section">
          <h4 className="form-section-title">Фото</h4>
          <ProductImagesEditor
            value={imageSlots}
            onChange={setImageSlots}
            disabled={readOnly}
          />
        </div>

        <div className="form-section">
          <h4 className="form-section-title">Характеристики</h4>
          <label className="field-label" htmlFor="product-material">
            Материал
          </label>
          <input
            id="product-material"
            className="field-input"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            disabled={readOnly}
          />

          <label className="field-label" htmlFor="product-country">
            Страна производитель
          </label>
          <input
            id="product-country"
            className="field-input"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={readOnly}
          />

          <label className="field-label" htmlFor="product-size">
            Размер
          </label>
          <input
            id="product-size"
            className="field-input"
            value={sizeField}
            onChange={(e) => setSizeField(e.target.value)}
            disabled={readOnly}
          />

          <label className="field-label" htmlFor="product-brand">
            Бренд
          </label>
          <input
            id="product-brand"
            className="field-input"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            disabled={readOnly}
          />

          <label className="field-label">Тип</label>
          <p className="muted-text">{primarySubcategoryName ?? '—'}</p>
          <p className="muted-text">
            Заполняется автоматически из основной подкатегории при сохранении.
          </p>
        </div>

        <div className="form-section">
          <h4 className="form-section-title">Габариты</h4>
          <p className="muted-text">
            Ручной ввод габаритов/веса сохраняется на бэкенде как source: manual.
          </p>
          <label className="field-label" htmlFor="product-weight">
            Вес (г)
          </label>
          <input
            id="product-weight"
            className="field-input"
            type="number"
            min="1"
            value={weightGrams}
            onChange={(e) => setWeightGrams(e.target.value)}
            disabled={readOnly}
          />
          <label className="field-label" htmlFor="product-dim-l">
            Длина (см)
          </label>
          <input
            id="product-dim-l"
            className="field-input"
            type="number"
            min="1"
            value={dimLengthCm}
            onChange={(e) => setDimLengthCm(e.target.value)}
            disabled={readOnly}
          />
          <label className="field-label" htmlFor="product-dim-w">
            Ширина (см)
          </label>
          <input
            id="product-dim-w"
            className="field-input"
            type="number"
            min="1"
            value={dimWidthCm}
            onChange={(e) => setDimWidthCm(e.target.value)}
            disabled={readOnly}
          />
          <label className="field-label" htmlFor="product-dim-h">
            Высота (см)
          </label>
          <input
            id="product-dim-h"
            className="field-input"
            type="number"
            min="1"
            value={dimHeightCm}
            onChange={(e) => setDimHeightCm(e.target.value)}
            disabled={readOnly}
          />
          <label className="field-label" htmlFor="product-dims-label">
            Размер (label)
          </label>
          <input
            id="product-dims-label"
            className="field-input"
            value={dimensionsLabel}
            onChange={(e) => setDimensionsLabel(e.target.value)}
            disabled={readOnly}
          />
        </div>

        <div className="form-actions">
          {!readOnly ? (
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          ) : null}
          {!isNew && !readOnly ? (
            <button
              type="button"
              className="secondary-button"
              disabled={archiving}
              onClick={() => void onToggleArchive()}
            >
              {archiving
                ? 'Обновление…'
                : product?.isArchived
                  ? 'Разархивировать'
                  : 'Архивировать'}
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
