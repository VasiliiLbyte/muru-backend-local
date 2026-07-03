/** VALUES clause for product upsert — keep in sync with upsertProductWithClient params. */
export const PRODUCT_UPSERT_VALUES_SQL =
  '($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,NOW())'

export const PRODUCT_UPSERT_PARAM_COUNT = 17