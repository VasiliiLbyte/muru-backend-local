import { catalogSearchInputClassName } from '../lib/catalogSearchInputClass'

type CatalogSearchProps = {
  value: string
  onChange: (value: string) => void
  onActivate?: () => void
}

export const CatalogSearch = ({ value, onChange, onActivate }: CatalogSearchProps) => {
  return (
    <div className="mb-3">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => onActivate?.()}
        onClick={() => onActivate?.()}
        placeholder="Поиск по названию или SKU"
        className={catalogSearchInputClassName}
      />
    </div>
  )
}
