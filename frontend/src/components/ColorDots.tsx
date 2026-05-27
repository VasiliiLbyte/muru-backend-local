const COLOR_HEX: Record<string, string> = {
  белый: '#ffffff',
  'чёрный': '#1a1a1a',
  черный: '#1a1a1a',
  серый: '#9ca3af',
  бежевый: '#e6d3b5',
  беж: '#e6d3b5',
  кремовый: '#f1e4cd',
  молочный: '#f7efde',
  коричневый: '#7b4f30',
  красный: '#c2371d',
  бордовый: '#7a1f1a',
  розовый: '#e8b4c0',
  оранжевый: '#d97742',
  'жёлтый': '#e8c259',
  желтый: '#e8c259',
  'зелёный': '#5a7642',
  зеленый: '#5a7642',
  олива: '#7a8a48',
  оливковый: '#7a8a48',
  голубой: '#a7c5d4',
  синий: '#3e5a7c',
  натуральный: '#c8b896',
  соломенный: '#c9a86b',
  золотой: '#c9a14a',
  серебряный: '#bdbdbd',
  антик: '#a39074',
  бисквит: '#e7d2a3',
}

export const ColorDots = ({ colors }: { colors: string[] }) => {
  if (colors.length === 0) return null
  return (
    <span className="ml-1 inline-flex items-center gap-1">
      {colors.slice(0, 4).map((c, idx) => {
        const hex = COLOR_HEX[c.toLowerCase()] ?? '#cccccc'
        return (
          <span
            key={`${c}-${idx}`}
            aria-label={c}
            className="inline-block h-3 w-3 rounded-full border border-[#00000020]"
            style={{ backgroundColor: hex }}
          />
        )
      })}
    </span>
  )
}
