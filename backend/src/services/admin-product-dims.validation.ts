export type ProductDimsUpdateInput = {
  weightGrams: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

const MAX_SIDE_CM = 150
const MAX_WEIGHT_GRAMS = 30_000

export const validateProductDimsUpdate = (
  input: ProductDimsUpdateInput,
): { ok: true } | { ok: false; message: string } => {
  const { weightGrams, lengthCm, widthCm, heightCm } = input
  const values = [weightGrams, lengthCm, widthCm, heightCm]
  if (!values.every((v) => Number.isInteger(v) && v > 0)) {
    return { ok: false, message: 'Все поля должны быть положительными целыми числами' }
  }
  if (lengthCm > MAX_SIDE_CM || widthCm > MAX_SIDE_CM || heightCm > MAX_SIDE_CM) {
    return { ok: false, message: 'Сторона коробки не более 150 см (лимит СДЭК)' }
  }
  if (weightGrams > MAX_WEIGHT_GRAMS) {
    return { ok: false, message: 'Вес не более 30 кг (лимит СДЭК)' }
  }
  return { ok: true }
}
