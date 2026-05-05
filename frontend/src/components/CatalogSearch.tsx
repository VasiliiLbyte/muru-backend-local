type CatalogSearchProps = {
  value: string
  onChange: (value: string) => void
}

export const CatalogSearch = ({ value, onChange }: CatalogSearchProps) => {
  return (
    <div className="catalog-search">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Поиск по названию или SKU"
        className="catalog-input"
      />
    </div>
  )
}
