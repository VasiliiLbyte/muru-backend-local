import { useEffect, useState } from 'react'

import { SmartImage } from '../components/SmartImage'
import {
  fetchAdminProductDims,
  resetAdminProductDims,
  updateAdminProductDims,
} from '../lib/api'
import { pressable, pressableDisabled } from '../lib/uiClasses'

type Row = {
  sku: string
  name: string
  dimensions_label: string
  weight_grams: number
  weight_source: 'auto' | 'manual'
  dim_length_cm: number
  dim_width_cm: number
  dim_height_cm: number
  dims_source: 'auto' | 'manual'
  image_url_1: string
}

type DimsRowProps = {
  row: Row
  userId: number
  onChange: () => void
}

const DimsRow = ({ row, userId, onChange }: DimsRowProps) => {
  const [w, setW] = useState(row.weight_grams)
  const [l, setL] = useState(row.dim_length_cm)
  const [wd, setWd] = useState(row.dim_width_cm)
  const [h, setH] = useState(row.dim_height_cm)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const dirty =
    w !== row.weight_grams ||
    l !== row.dim_length_cm ||
    wd !== row.dim_width_cm ||
    h !== row.dim_height_cm

  return (
    <div className="rounded-xl border border-muru-accent bg-[#fff9ed] p-3">
      <div className="flex items-start gap-3">
        <SmartImage
          src={row.image_url_1}
          alt={row.name}
          className="h-14 w-14 shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.name}</p>
          <p className="text-xs text-[#7a7165]">
            {row.sku} · {row.dimensions_label || '—'}
          </p>
          <div className="mt-1 flex gap-2 text-[11px]">
            <span
              className={
                row.dims_source === 'manual' ? 'font-semibold text-muru-olive' : 'text-[#9b8d72]'
              }
            >
              размеры: {row.dims_source === 'manual' ? 'вручную' : 'из xlsx'}
            </span>
            <span
              className={
                row.weight_source === 'manual' ? 'font-semibold text-muru-olive' : 'text-[#9b8d72]'
              }
            >
              вес: {row.weight_source === 'manual' ? 'вручную' : 'оценка'}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
        <label>
          Вес, г
          <input
            type="number"
            min={1}
            max={30000}
            value={w}
            onChange={(e) => setW(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded border bg-white px-2 py-1"
          />
        </label>
        <label>
          Длина, см
          <input
            type="number"
            min={1}
            max={150}
            value={l}
            onChange={(e) => setL(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded border bg-white px-2 py-1"
          />
        </label>
        <label>
          Ширина, см
          <input
            type="number"
            min={1}
            max={150}
            value={wd}
            onChange={(e) => setWd(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded border bg-white px-2 py-1"
          />
        </label>
        <label>
          Высота, см
          <input
            type="number"
            min={1}
            max={150}
            value={h}
            onChange={(e) => setH(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded border bg-white px-2 py-1"
          />
        </label>
      </div>
      {err ? <p className="mt-1 text-xs text-red-700">{err}</p> : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!dirty || busy}
          className={`${pressableDisabled} rounded-xl bg-muru-olive px-3 py-1 text-xs text-muru-ivory`}
          onClick={async () => {
            setBusy(true)
            setErr(null)
            try {
              await updateAdminProductDims(userId, row.sku, {
                weightGrams: w,
                lengthCm: l,
                widthCm: wd,
                heightCm: h,
              })
              onChange()
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Ошибка')
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Сохраняем…' : 'Сохранить вручную'}
        </button>
        {row.dims_source === 'manual' || row.weight_source === 'manual' ? (
          <button
            type="button"
            disabled={busy}
            className={`${pressable} rounded-xl bg-[#efe8d8] px-3 py-1 text-xs`}
            onClick={async () => {
              if (
                !window.confirm(
                  'Сбросить на авто-расчёт? При следующем синке размеры и вес возьмутся из xlsx и материала.',
                )
              ) {
                return
              }
              setBusy(true)
              setErr(null)
              try {
                await resetAdminProductDims(userId, row.sku)
                onChange()
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Ошибка')
              } finally {
                setBusy(false)
              }
            }}
          >
            Сбросить на авто
          </button>
        ) : null}
      </div>
    </div>
  )
}

type AdminProductDimsSectionProps = {
  userId: number
}

export const AdminProductDimsSection = ({ userId }: AdminProductDimsSectionProps) => {
  const [items, setItems] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'default' | 'manual'>('all')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setItems(await fetchAdminProductDims(userId, q, filter))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filter changes
  }, [filter])

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Габариты товаров</h2>
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
          placeholder="SKU или название"
          className="min-w-40 flex-1 rounded-xl border border-muru-accent bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          className={`${pressable} rounded-xl bg-muru-olive px-3 py-2 text-sm text-muru-ivory`}
          onClick={() => void load()}
        >
          Поиск
        </button>
      </div>
      <div className="flex gap-2 text-xs">
        {(['all', 'default', 'manual'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`${pressable} rounded-full px-3 py-1 ${filter === f ? 'bg-muru-olive text-muru-ivory' : 'bg-[#efe8d8]'}`}
          >
            {f === 'all' ? 'Все' : f === 'default' ? 'Дефолтные (20×20×20)' : 'Ручная правка'}
          </button>
        ))}
      </div>
      {loading ? <p className="text-sm">Загрузка…</p> : null}
      <div className="grid gap-2">
        {items.map((row) => (
          <DimsRow key={row.sku} row={row} userId={userId} onChange={() => void load()} />
        ))}
      </div>
    </section>
  )
}
