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
    <div className="catalog-filters">
      <input
        className="catalog-input"
        placeholder="Фильтр по цвету"
        value={color}
        onChange={(event) => onColorChange(event.target.value)}
      />
      <input
        className="catalog-input"
        placeholder="Фильтр по размеру"
        value={size}
        onChange={(event) => onSizeChange(event.target.value)}
      />
      <input
        className="catalog-input"
        placeholder="Макс. цена"
        value={priceMax}
        onChange={(event) => onPriceMaxChange(event.target.value)}
      />
    </div>
  )
}
