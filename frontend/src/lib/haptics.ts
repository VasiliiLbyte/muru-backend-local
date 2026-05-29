type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'

const hf = () => window.Telegram?.WebApp?.HapticFeedback

export const hapticImpact = (style: HapticStyle = 'light'): void => {
  try {
    hf()?.impactOccurred?.(style)
  } catch {
    /* unsupported — ignore */
  }
}

export const hapticSelection = (): void => {
  try {
    hf()?.selectionChanged?.()
  } catch {
    /* ignore */
  }
}
