/** Tactile feedback for buttons and tappable rows (Telegram Mini App / iOS). */
export const pressable = 'touch-manipulation transition-transform duration-150 active:scale-[0.97]'

/** Smaller targets (e.g. image dots) — slightly subtler scale. */
export const pressableTight = 'touch-manipulation transition-transform duration-150 active:scale-[0.94]'

/** For controls that can be disabled — avoids “dead” press animation. */
export const pressableDisabled = `${pressable} disabled:pointer-events-none disabled:opacity-50`

/** Soft floating card surface — no hard border, faint shadow (ARKET/Zara Home feel). */
export const cardSurface =
  'rounded-2xl bg-[#fffaf3] shadow-[0_2px_10px_rgba(60,55,40,0.05)]'
