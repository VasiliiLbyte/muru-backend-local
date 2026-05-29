import type { FC } from 'react'

type GlyphProps = { className?: string }

/** Мягкое оливковое сердце (палитра MURU). */
export const HeartGlyph: FC<GlyphProps> = ({ className = '' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    fillOpacity="0.12"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden
  >
    <path
      d="M12 21s-7-4.35-7-10a5 5 0 0 1 9.5-2 5 5 0 0 1 9.5 2c0 5.65-7 10-7 10z"
      strokeLinejoin="round"
    />
  </svg>
)

/** Line-art «чек/заказ» (палитра MURU). */
export const ReceiptGlyph: FC<GlyphProps> = ({ className = '' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden
  >
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" strokeLinejoin="round" />
    <path d="M9 8h6M9 12h6" strokeLinecap="round" />
  </svg>
)
