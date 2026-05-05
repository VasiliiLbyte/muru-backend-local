type CatalogSearchProps = {
  value: string
  onChange: (value: string) => void
}

export const CatalogSearch = ({ value, onChange }: CatalogSearchProps) => {
  return (
    <div className="mb-3">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Поиск по названию или SKU"
        className="w-full rounded-xl border border-muru-accent bg-[#fff9ed] px-3 py-2 text-sm"
      />
    </div>
  )
}
