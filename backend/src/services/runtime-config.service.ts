import {
  PRODUCT_DEFAULT_DIM_HEIGHT_CM,
  PRODUCT_DEFAULT_DIM_LENGTH_CM,
  PRODUCT_DEFAULT_DIM_WIDTH_CM,
  PRODUCT_DEFAULT_WEIGHT_GRAMS,
} from '../constants/product-shipping-defaults'
import { pool } from '../utils/db'
import { env } from '../utils/env'

export type CdekEnvMode = 'test' | 'production'

export type EffectiveCdekConfig = {
  env: CdekEnvMode
  clientId: string
  clientSecret: string
  webhookSecret: string
  senderCityCode: number
  senderPostalCode: string
  senderAddress: string
  senderName: string
  senderPhone: string
  tariffDoor: number
  tariffPvz: number
  defaultWeightGrams: number
  defaultLengthCm: number
  defaultWidthCm: number
  defaultHeightCm: number
}

export type EffectiveYookassaConfig = {
  vatCode: number
  verifyIp: boolean
  shopId: string
  secretKey: string
  webShopId: string
  webSecretKey: string
  returnUrl: string
  webReturnUrl: string
  enabled: boolean
}

export type EffectiveConfig = {
  cdek: EffectiveCdekConfig
  yookassa: EffectiveYookassaConfig
}

type RuntimeSettingsRow = {
  cdek_env: string | null
  cdek_sender_city_code: number | null
  cdek_sender_postal_code: string | null
  cdek_sender_address: string | null
  cdek_sender_name: string | null
  cdek_sender_phone: string | null
  cdek_tariff_door: number | null
  cdek_tariff_pvz: number | null
  cdek_default_weight_grams: number | null
  cdek_default_length_cm: number | null
  cdek_default_width_cm: number | null
  cdek_default_height_cm: number | null
  yookassa_vat_code: number | null
  yookassa_verify_ip: boolean | null
}

const TTL_MS = 5_000

let cache: EffectiveConfig | null = null
let cacheAt = 0
let onInvalidate: (() => void) | null = null

/** Register side-effect when config cache is cleared (e.g. CDEK token reset). */
export const setRuntimeConfigInvalidateHook = (hook: (() => void) | null): void => {
  onInvalidate = hook
}

export const invalidateRuntimeConfigCache = (): void => {
  cache = null
  cacheAt = 0
  onInvalidate?.()
}

const unsetText = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

const coalesceText = (db: string | null | undefined, fallback: string): string =>
  unsetText(db) ?? fallback

const coalesceInt = (db: number | null | undefined, fallback: number): number =>
  db === null || db === undefined || !Number.isFinite(db) ? fallback : db

const coalesceBool = (db: boolean | null | undefined, fallback: boolean): boolean =>
  db === null || db === undefined ? fallback : db

const loadRow = async (): Promise<RuntimeSettingsRow | null> => {
  try {
    const result = await pool.query<RuntimeSettingsRow>(
      `SELECT
        cdek_env, cdek_sender_city_code, cdek_sender_postal_code, cdek_sender_address,
        cdek_sender_name, cdek_sender_phone, cdek_tariff_door, cdek_tariff_pvz,
        cdek_default_weight_grams, cdek_default_length_cm, cdek_default_width_cm,
        cdek_default_height_cm, yookassa_vat_code, yookassa_verify_ip
       FROM site_settings WHERE id = 1`,
    )
    return result.rows[0] ?? null
  } catch {
    // Table/columns may be missing in early boot or tests without migration — fall back to env.
    return null
  }
}

export const buildEffectiveConfigFromRow = (row: RuntimeSettingsRow | null): EffectiveConfig => {
  const dbEnv = unsetText(row?.cdek_env)
  const cdekEnv: CdekEnvMode =
    dbEnv === 'production' || dbEnv === 'test' ? dbEnv : env.cdek.env

  return {
    cdek: {
      env: cdekEnv,
      clientId: env.cdek.clientId,
      clientSecret: env.cdek.clientSecret,
      webhookSecret: env.cdek.webhookSecret,
      senderCityCode: coalesceInt(row?.cdek_sender_city_code, env.cdek.senderCityCode),
      senderPostalCode: coalesceText(row?.cdek_sender_postal_code, env.cdek.senderPostalCode),
      senderAddress: coalesceText(row?.cdek_sender_address, env.cdek.senderAddress),
      senderName: coalesceText(row?.cdek_sender_name, env.cdek.senderName),
      senderPhone: coalesceText(row?.cdek_sender_phone, env.cdek.senderPhone),
      tariffDoor: coalesceInt(row?.cdek_tariff_door, env.cdek.tariffDoor),
      tariffPvz: coalesceInt(row?.cdek_tariff_pvz, env.cdek.tariffPvz),
      defaultWeightGrams: coalesceInt(row?.cdek_default_weight_grams, PRODUCT_DEFAULT_WEIGHT_GRAMS),
      defaultLengthCm: coalesceInt(row?.cdek_default_length_cm, PRODUCT_DEFAULT_DIM_LENGTH_CM),
      defaultWidthCm: coalesceInt(row?.cdek_default_width_cm, PRODUCT_DEFAULT_DIM_WIDTH_CM),
      defaultHeightCm: coalesceInt(row?.cdek_default_height_cm, PRODUCT_DEFAULT_DIM_HEIGHT_CM),
    },
    yookassa: {
      vatCode: coalesceInt(row?.yookassa_vat_code, env.yookassa.vatCode),
      verifyIp: coalesceBool(row?.yookassa_verify_ip, env.yookassa.verifyIp),
      shopId: env.yookassa.shopId,
      secretKey: env.yookassa.secretKey,
      webShopId: env.yookassa.webShopId,
      webSecretKey: env.yookassa.webSecretKey,
      returnUrl: env.yookassa.returnUrl,
      webReturnUrl: env.yookassa.webReturnUrl,
      enabled: env.yookassa.enabled,
    },
  }
}

export const getEffectiveConfig = async (): Promise<EffectiveConfig> => {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache
  const row = await loadRow()
  cache = buildEffectiveConfigFromRow(row)
  cacheAt = Date.now()
  return cache
}
