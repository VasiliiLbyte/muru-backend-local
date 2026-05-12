/** Tactile feedback for buttons and tappable rows (Telegram Mini App / iOS). */
export const pressable = 'touch-manipulation transition-transform duration-150 active:scale-95'

/** Smaller targets (e.g. image dots) — slightly subtler scale. */
export const pressableTight = 'touch-manipulation transition-transform duration-150 active:scale-90'

/** For controls that can be disabled — avoids “dead” press animation. */
export const pressableDisabled = `${pressable} disabled:pointer-events-none disabled:opacity-50`
