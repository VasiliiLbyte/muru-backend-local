type CatalogFiltersProps = {
  color: string
  size: string
  priceMax: string
  onColorChange: (value: string) => void
  onSizeChange: (value: string) => void
  onPriceMaxChange: (value: string) => void
}

export const CatalogFilters = ({
  color,
  size,
  priceMax,
  onColorChange,
  onSizeChange,
  onPriceMaxChange,
}: CatalogFiltersProps) => {
  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      <input
        className="w-full rounded-xl border border-muru-accent bg-[#fff9ed] px-3 py-2 text-sm"
        placeholder="Фильтр по цвету"
        value={color}
        onChange={(event) => onColorChange(event.target.value)}
      />
      <input
        className="w-full rounded-xl border border-muru-accent bg-[#fff9ed] px-3 py-2 text-sm"
        placeholder="Фильтр по размеру"
        value={size}
        onChange={(event) => onSizeChange(event.target.value)}
      />
      <input
        className="w-full rounded-xl border border-muru-accent bg-[#fff9ed] px-3 py-2 text-sm"
        placeholder="Макс. цена"
        value={priceMax}
        onChange={(event) => onPriceMaxChange(event.target.value)}
      />
    </div>
  )
}
