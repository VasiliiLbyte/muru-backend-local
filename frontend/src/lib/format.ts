const rubFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** «49000» -> «49 000 ₽»; копейки показываются только если они есть (49000.5 -> «49 000,5 ₽»). */
export const formatPrice = (value: number): string => `${rubFormatter.format(value)} ₽`
