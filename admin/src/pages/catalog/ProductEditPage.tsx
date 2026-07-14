import { useCallback, useEffect, useState } from 'react'
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
  listCharacteristics,
  patchProduct,
  unarchiveProduct,
  updateProductStock,
} from '../../lib/catalog-api'
import type {
  CrmCatalogProductDetail,
  CrmCategoryItem,
  CrmCharacteristicItem,
  ProductImageSlot,
} from '../../types/catalog'

const CUSTOM_SPEC_KEY = '__custom__'

type SpecRow = {
  id: string
  keySelect: string
  customKey: string
  value: string
}

const specsToRows = (specs: Record<string, string>, characteristicNames: string[]): SpecRow[] => {
  const entries = Object.entries(specs)
  if (entries.length === 0) {
    return [{ id: '0', keySelect: characteristicNames[0] ?? CUSTOM_SPEC_KEY, customKey: '', value: '' }]
  }
  return entries.map(([key, value], index) => {
    const inDict = characteristicNames.includes(key)
    return {
      id: String(index),
      keySelect: inDict ? key : CUSTOM_SPEC_KEY,
      customKey: inDict ? '' : key,
      value,
    }
  })
}

const rowsToSpecs = (rows: SpecRow[]): Record<string, string> => {
  const specs: Record<string, string> = {}
  for (const row of rows) {
    const key = row.keySelect === CUSTOM_SPEC_KEY ? row.customKey.trim() : row.keySelect
    const value = row.value.trim()
    if (key && value) specs[key] = value
  }
  return specs
}

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
  const [characteristics, setCharacteristics] = useState<CrmCharacteristicItem[]>([])

  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [discountPercent, setDiscountPercent] = useState('0')
  const [inStock, setInStock] = useState('0')
  const [categoryId, setCategoryId] = useState('')
  const [webSubcategoryName, setWebSubcategoryName] = useState('')
  const [imageSlots, setImageSlots] = useState<ProductImageSlot[]>([])
  const [specRows, setSpecRows] = useState<SpecRow[]>([])
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

  const characteristicNames = characteristics.map((c) => c.name)

  const applyProductToForm = useCallback((data: CrmCatalogProductDetail) => {
    setSku(data.sku)
    setName(data.name)
    setDescription(data.description ?? '')
    setPrice(String(data.price))
    setDiscountPercent(String(data.discountPercent))
    setInStock(String(data.inStock))
    setCategoryId(data.categoryId != null ? String(data.categoryId) : '')
    setWebSubcategoryName(data.webSubcategoryName ?? '')
    setImageSlots(productToImageSlots(data))
    setWeightGrams(String(data.weightGrams))
    setDimLengthCm(String(data.dimLengthCm))
    setDimWidthCm(String(data.dimWidthCm))
    setDimHeightCm(String(data.dimHeightCm))
    setDimensionsLabel(data.dimensionsLabel ?? '')
  }, [])

  useEffect(() => {
    void Promise.all([listCategories(), listCharacteristics()])
      .then(([cats, chars]) => {
        setCategories(cats.items)
        setCharacteristics(chars.items)
      })
      .catch(() => {
        setCategories([])
        setCharacteristics([])
      })
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

  useEffect(() => {
    const names = characteristics.map((c) => c.name)
    if (product) {
      setSpecRows(specsToRows(product.specs ?? {}, names))
      return
    }
    if (isNew) {
      setSpecRows(specsToRows({}, names))
    }
  }, [product, characteristics, isNew])

  const buildBody = () => {
    const imageUrls = imageSlots.map((s) => s.url)
    return {
      name: name.trim(),
      description,
      price: Number(price) || 0,
      discountPercent: Number(discountPercent) || 0,
      inStock: Number(inStock) || 0,
      categoryId: categoryId ? Number(categoryId) : null,
      webSubcategoryName: webSubcategoryName.trim() || null,
      specs: rowsToSpecs(specRows),
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

  const addSpecRow = () => {
    setSpecRows((rows) => [
      ...rows,
      {
        id: String(Date.now()),
        keySelect: characteristicNames[0] ?? CUSTOM_SPEC_KEY,
        customKey: '',
        value: '',
      },
    ])
  }

  const updateSpecRow = (rowId: string, patch: Partial<SpecRow>) => {
    setSpecRows((rows) => rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
  }

  const removeSpecRow = (rowId: string) => {
    setSpecRows((rows) => rows.filter((row) => row.id !== rowId))
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
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <label className="field-label" htmlFor="product-subcategory">
            Подкатегория (web)
          </label>
          <input
            id="product-subcategory"
            className="field-input"
            value={webSubcategoryName}
            onChange={(e) => setWebSubcategoryName(e.target.value)}
            disabled={readOnly}
          />
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
          {specRows.map((row) => (
            <div key={row.id} className="specs-editor-row">
              <select
                className="field-input"
                value={row.keySelect}
                onChange={(e) => updateSpecRow(row.id, { keySelect: e.target.value })}
                disabled={readOnly}
              >
                {characteristicNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value={CUSTOM_SPEC_KEY}>Другой…</option>
              </select>
              {row.keySelect === CUSTOM_SPEC_KEY ? (
                <input
                  className="field-input"
                  placeholder="Название"
                  value={row.customKey}
                  onChange={(e) => updateSpecRow(row.id, { customKey: e.target.value })}
                  disabled={readOnly}
                />
              ) : null}
              <input
                className="field-input"
                placeholder="Значение"
                value={row.value}
                onChange={(e) => updateSpecRow(row.id, { value: e.target.value })}
                disabled={readOnly}
              />
              {!readOnly ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => removeSpecRow(row.id)}
                >
                  Удалить
                </button>
              ) : null}
            </div>
          ))}
          {!readOnly ? (
            <button type="button" className="secondary-button" onClick={addSpecRow}>
              Добавить характеристику
            </button>
          ) : null}
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
