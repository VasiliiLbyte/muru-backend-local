import { useCallback, useEffect, useRef, useState } from 'react'

import { getProduct, listProducts } from '../../lib/catalog-api'
import { categoryCoverPreviewSrc } from '../../lib/category-cover'
import {
  createLookbookHotspot,
  deleteLookbookHotspot,
  listLookbookHotspots,
  updateLookbookHotspot,
} from '../../lib/content-api'
import type {
  ContentImage,
  CrmLookbookHotspot,
  HotspotRowView,
} from '../../types/content'
import type { CrmCatalogListItem } from '../../types/catalog'

type HotspotEditorProps = {
  lookbookId: string
  bannerImage: ContentImage
  readOnly?: boolean
}

type PendingCoords = {
  xPercent: number
  yPercent: number
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

const roundPercent = (value: number) => Math.round(value * 100) / 100

export const HotspotEditor = ({ lookbookId, bannerImage, readOnly = false }: HotspotEditorProps) => {
  const bannerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    hotspotId: string
    originX: number
    originY: number
    latestX: number
    latestY: number
  } | null>(null)

  const [hotspots, setHotspots] = useState<CrmLookbookHotspot[]>([])
  const [productLabels, setProductLabels] = useState<Map<number, { sku: string; name: string }>>(
    new Map(),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingCoords, setPendingCoords] = useState<PendingCoords | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerResults, setPickerResults] = useState<CrmCatalogListItem[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError, setPickerError] = useState('')
  const [creating, setCreating] = useState(false)

  const [draftCoords, setDraftCoords] = useState<Record<string, { x: string; y: string }>>({})

  const bannerSrc = categoryCoverPreviewSrc(bannerImage.url) ?? bannerImage.url

  const loadProductLabels = useCallback(async (items: CrmLookbookHotspot[]) => {
    const ids = [...new Set(items.map((item) => item.productId))]
    const entries = await Promise.all(
      ids.map(async (productId) => {
        try {
          const product = await getProduct(productId)
          return [productId, { sku: product.sku, name: product.name }] as const
        } catch {
          return [productId, { sku: `#${productId}`, name: '—' }] as const
        }
      }),
    )
    setProductLabels(new Map(entries))
  }, [])

  const loadHotspots = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const items = await listLookbookHotspots(lookbookId)
      setHotspots(items)
      setDraftCoords(
        Object.fromEntries(
          items.map((item) => [
            item.id,
            { x: String(item.xPercent), y: String(item.yPercent) },
          ]),
        ),
      )
      await loadProductLabels(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить точки')
    } finally {
      setLoading(false)
    }
  }, [lookbookId, loadProductLabels])

  useEffect(() => {
    void loadHotspots()
  }, [loadHotspots])

  const onBannerClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (readOnly || pickerOpen) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const xPercent = roundPercent(((event.clientX - rect.left) / rect.width) * 100)
    const yPercent = roundPercent(((event.clientY - rect.top) / rect.height) * 100)
    setPendingCoords({ xPercent, yPercent })
    setPickerQuery('')
    setPickerResults([])
    setPickerError('')
    setPickerOpen(true)
  }

  const onSearchProducts = async () => {
    const q = pickerQuery.trim()
    if (!q) return
    setPickerLoading(true)
    setPickerError('')
    try {
      const result = await listProducts({ q, archived: 'false', pageSize: 20 })
      setPickerResults(result.items)
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : 'Не удалось найти товары')
    } finally {
      setPickerLoading(false)
    }
  }

  const onPickProduct = async (product: CrmCatalogListItem) => {
    if (!pendingCoords || readOnly) return
    setCreating(true)
    setPickerError('')
    try {
      await createLookbookHotspot(lookbookId, {
        productId: product.id,
        xPercent: pendingCoords.xPercent,
        yPercent: pendingCoords.yPercent,
      })
      setPickerOpen(false)
      setPendingCoords(null)
      await loadHotspots()
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : 'Не удалось создать точку')
    } finally {
      setCreating(false)
    }
  }

  const onDelete = async (hotspotId: string) => {
    if (readOnly) return
    if (!window.confirm('Удалить точку?')) return
    setSavingId(hotspotId)
    setError('')
    try {
      await deleteLookbookHotspot(lookbookId, hotspotId)
      await loadHotspots()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить точку')
    } finally {
      setSavingId(null)
    }
  }

  const persistCoords = async (hotspot: CrmLookbookHotspot) => {
    if (readOnly) return
    const draft = draftCoords[hotspot.id]
    if (!draft) return
    const xPercent = roundPercent(Number(draft.x))
    const yPercent = roundPercent(Number(draft.y))
    if (!Number.isFinite(xPercent) || !Number.isFinite(yPercent)) return
    if (xPercent < 0 || xPercent > 100 || yPercent < 0 || yPercent > 100) return
    if (xPercent === hotspot.xPercent && yPercent === hotspot.yPercent) return

    setSavingId(hotspot.id)
    setError('')
    try {
      await updateLookbookHotspot(lookbookId, hotspot.id, { xPercent, yPercent })
      await loadHotspots()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить координаты')
    } finally {
      setSavingId(null)
    }
  }

  const onMarkerPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    hotspot: CrmLookbookHotspot,
  ) => {
    if (readOnly) return
    event.preventDefault()
    event.stopPropagation()
    const banner = bannerRef.current
    if (!banner) return
    dragRef.current = {
      hotspotId: hotspot.id,
      originX: hotspot.xPercent,
      originY: hotspot.yPercent,
      latestX: hotspot.xPercent,
      latestY: hotspot.yPercent,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onMarkerPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const banner = bannerRef.current
    if (!drag || !banner || drag.hotspotId !== event.currentTarget.dataset.hotspotId) return

    const rect = banner.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const xPx = event.clientX - rect.left
    const yPx = event.clientY - rect.top
    const xPercent = roundPercent(clampPercent((xPx / rect.width) * 100))
    const yPercent = roundPercent(clampPercent((yPx / rect.height) * 100))

    drag.latestX = xPercent
    drag.latestY = yPercent

    setHotspots((prev) =>
      prev.map((item) =>
        item.id === drag.hotspotId ? { ...item, xPercent, yPercent } : item,
      ),
    )
    setDraftCoords((prev) => ({
      ...prev,
      [drag.hotspotId]: { x: String(xPercent), y: String(yPercent) },
    }))
  }

  const onMarkerPointerUp = async (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.hotspotId !== event.currentTarget.dataset.hotspotId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)

    if (drag.latestX === drag.originX && drag.latestY === drag.originY) return

    setSavingId(drag.hotspotId)
    setError('')
    try {
      await updateLookbookHotspot(lookbookId, drag.hotspotId, {
        xPercent: drag.latestX,
        yPercent: drag.latestY,
      })
      await loadHotspots()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить координаты')
      await loadHotspots()
    } finally {
      setSavingId(null)
    }
  }

  const rows: HotspotRowView[] = hotspots.map((hotspot) => ({
    hotspot,
    sku: productLabels.get(hotspot.productId)?.sku,
    name: productLabels.get(hotspot.productId)?.name,
  }))

  return (
    <div className="hotspot-editor">
      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted-text">Загрузка точек...</p> : null}

      <p className="muted-text">
        {readOnly
          ? 'Точки на баннере (только просмотр)'
          : 'Кликните по баннеру, чтобы добавить точку и привязать товар'}
      </p>

      <div className="hotspot-editor-cover" ref={bannerRef}>
        <img
          src={bannerSrc}
          alt={bannerImage.alt ?? 'Баннер лукбука'}
          className="hotspot-editor-cover-img"
          onClick={onBannerClick}
        />
        {hotspots.map((hotspot) => (
          <button
            key={hotspot.id}
            type="button"
            className="hotspot-marker"
            data-hotspot-id={hotspot.id}
            style={{
              left: `${hotspot.xPercent}%`,
              top: `${hotspot.yPercent}%`,
            }}
            title={productLabels.get(hotspot.productId)?.sku ?? `Товар #${hotspot.productId}`}
            disabled={readOnly || savingId === hotspot.id}
            onPointerDown={(event) => onMarkerPointerDown(event, hotspot)}
            onPointerMove={onMarkerPointerMove}
            onPointerUp={(event) => void onMarkerPointerUp(event)}
          >
            +
          </button>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="table-wrap hotspot-editor-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Название</th>
                <th>X %</th>
                <th>Y %</th>
                {!readOnly ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ hotspot, sku, name }) => (
                <tr key={hotspot.id}>
                  <td>{sku ?? `#${hotspot.productId}`}</td>
                  <td>{name ?? '—'}</td>
                  <td>
                    <input
                      className="field-input hotspot-coord-input"
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={draftCoords[hotspot.id]?.x ?? String(hotspot.xPercent)}
                      disabled={readOnly || savingId === hotspot.id}
                      onChange={(e) =>
                        setDraftCoords((prev) => ({
                          ...prev,
                          [hotspot.id]: {
                            x: e.target.value,
                            y: prev[hotspot.id]?.y ?? String(hotspot.yPercent),
                          },
                        }))
                      }
                      onBlur={() => void persistCoords(hotspot)}
                    />
                  </td>
                  <td>
                    <input
                      className="field-input hotspot-coord-input"
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={draftCoords[hotspot.id]?.y ?? String(hotspot.yPercent)}
                      disabled={readOnly || savingId === hotspot.id}
                      onChange={(e) =>
                        setDraftCoords((prev) => ({
                          ...prev,
                          [hotspot.id]: {
                            x: prev[hotspot.id]?.x ?? String(hotspot.xPercent),
                            y: e.target.value,
                          },
                        }))
                      }
                      onBlur={() => void persistCoords(hotspot)}
                    />
                  </td>
                  {!readOnly ? (
                    <td>
                      <button
                        type="button"
                        className="link-button link-button-danger"
                        disabled={savingId === hotspot.id}
                        onClick={() => void onDelete(hotspot.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pickerOpen ? (
        <div className="form-section hotspot-picker">
          <h4 className="form-section-title">
            Привязать товар
            {pendingCoords
              ? ` (${pendingCoords.xPercent}%, ${pendingCoords.yPercent}%)`
              : ''}
          </h4>
          {pickerError ? <p className="error-text">{pickerError}</p> : null}
          <div className="form-actions">
            <input
              className="field-input"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="SKU или название"
            />
            <button
              type="button"
              className="secondary-button"
              disabled={pickerLoading || !pickerQuery.trim()}
              onClick={() => void onSearchProducts()}
            >
              {pickerLoading ? 'Поиск…' : 'Найти'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setPickerOpen(false)
                setPendingCoords(null)
              }}
            >
              Отмена
            </button>
          </div>
          {pickerResults.length > 0 ? (
            <ul className="catalog-section-links">
              {pickerResults.map((product) => (
                <li key={product.id}>
                  {product.sku} — {product.name}
                  <button
                    type="button"
                    className="link-button"
                    disabled={creating}
                    onClick={() => void onPickProduct(product)}
                  >
                    {creating ? 'Добавление…' : 'Выбрать'}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
