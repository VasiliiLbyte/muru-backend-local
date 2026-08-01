import { z } from 'zod'

import { HttpError } from '../utils/api-response'
import { pool } from '../utils/db'
import { env } from '../utils/env'
import { invalidateRuntimeConfigCache } from './runtime-config.service'

export const SETTINGS_ID = 1

const emptyToNull = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

/** Soft email: empty/null OK; non-empty must be a valid email. */
const softEmailSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => emptyToNull(value ?? null))
  .refine((value) => value === null || z.string().email().safeParse(value).success, {
    message: 'Некорректный email.',
  })

const softTextSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => emptyToNull(value ?? null))

const softNumberSchema = z
  .union([z.number(), z.null()])
  .optional()
  .transform((value) => (value === undefined ? null : value))

const softIntSchema = z
  .union([z.number().int(), z.null()])
  .optional()
  .transform((value) => (value === undefined ? null : value))

export const contactSettingsInputSchema = z
  .object({
    contactPhoneDisplay: softTextSchema,
    contactPhoneHref: softTextSchema,
    contactEmail: softEmailSchema,
    contactAddress: softTextSchema,
    contactHours: softTextSchema,
    contactMapLat: softNumberSchema,
    contactMapLng: softNumberSchema,
    contactMapZoom: softIntSchema,
    socialTelegram: softTextSchema,
    socialWhatsapp: softTextSchema,
    socialVk: softTextSchema,
  })
  .strict()

export const requisitesSettingsInputSchema = z
  .object({
    reqFullName: softTextSchema,
    reqShortName: softTextSchema,
    reqInn: softTextSchema,
    reqOgrnip: softTextSchema,
    reqLegalAddress: softTextSchema,
    reqActualAddress: softTextSchema,
    reqPhone: softTextSchema,
    reqEmail: softEmailSchema,
    reqSite: softTextSchema,
    reqBankDetails: softTextSchema,
  })
  .strict()

export const cdekSettingsInputSchema = z
  .object({
    cdekEnv: z.enum(['test', 'production']).nullable().optional(),
    cdekSenderCityCode: softIntSchema,
    cdekSenderPostalCode: softTextSchema,
    cdekSenderAddress: softTextSchema,
    cdekSenderName: softTextSchema,
    cdekSenderPhone: softTextSchema,
    cdekTariffDoor: softIntSchema,
    cdekTariffPvz: softIntSchema,
    cdekDefaultWeightGrams: softIntSchema,
    cdekDefaultLengthCm: softIntSchema,
    cdekDefaultWidthCm: softIntSchema,
    cdekDefaultHeightCm: softIntSchema,
  })
  .strict()

export const yookassaSettingsInputSchema = z
  .object({
    yookassaVatCode: softIntSchema,
    yookassaVerifyIp: z.union([z.boolean(), z.null()]).optional(),
  })
  .strict()

export type ContactSettingsInput = z.output<typeof contactSettingsInputSchema>
export type RequisitesSettingsInput = z.output<typeof requisitesSettingsInputSchema>
export type CdekSettingsInput = z.output<typeof cdekSettingsInputSchema>
export type YookassaSettingsInput = z.output<typeof yookassaSettingsInputSchema>

export type SiteSettingsDto = {
  contactPhoneDisplay: string | null
  contactPhoneHref: string | null
  contactEmail: string | null
  contactAddress: string | null
  contactHours: string | null
  contactMapLat: number | null
  contactMapLng: number | null
  contactMapZoom: number | null
  socialTelegram: string | null
  socialWhatsapp: string | null
  socialVk: string | null
  reqFullName: string | null
  reqShortName: string | null
  reqInn: string | null
  reqOgrnip: string | null
  reqLegalAddress: string | null
  reqActualAddress: string | null
  reqPhone: string | null
  reqEmail: string | null
  reqSite: string | null
  reqBankDetails: string | null
  cdekEnv: 'test' | 'production' | null
  cdekSenderCityCode: number | null
  cdekSenderPostalCode: string | null
  cdekSenderAddress: string | null
  cdekSenderName: string | null
  cdekSenderPhone: string | null
  cdekTariffDoor: number | null
  cdekTariffPvz: number | null
  cdekDefaultWeightGrams: number | null
  cdekDefaultLengthCm: number | null
  cdekDefaultWidthCm: number | null
  cdekDefaultHeightCm: number | null
  yookassaVatCode: number | null
  yookassaVerifyIp: boolean | null
  updatedAt: string | null
}

export type PublicSiteContacts = {
  contactPhoneDisplay: string | null
  contactPhoneHref: string | null
  contactEmail: string | null
  contactAddress: string | null
  contactHours: string | null
  contactMapLat: number | null
  contactMapLng: number | null
  contactMapZoom: number | null
  socialTelegram: string | null
  socialWhatsapp: string | null
  socialVk: string | null
}

export type PublicRequisites = {
  reqFullName: string | null
  reqShortName: string | null
  reqInn: string | null
  reqOgrnip: string | null
  reqLegalAddress: string | null
  reqActualAddress: string | null
  reqPhone: string | null
  reqEmail: string | null
  reqSite: string | null
  reqBankDetails: string | null
}

type SiteSettingsRow = {
  contact_phone_display: string | null
  contact_phone_href: string | null
  contact_email: string | null
  contact_address: string | null
  contact_hours: string | null
  contact_map_lat: number | null
  contact_map_lng: number | null
  contact_map_zoom: number | null
  social_telegram: string | null
  social_whatsapp: string | null
  social_vk: string | null
  req_full_name: string | null
  req_short_name: string | null
  req_inn: string | null
  req_ogrnip: string | null
  req_legal_address: string | null
  req_actual_address: string | null
  req_phone: string | null
  req_email: string | null
  req_site: string | null
  req_bank_details: string | null
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
  updated_at: Date | string | null
}

const nullSettings = (): SiteSettingsDto => ({
  contactPhoneDisplay: null,
  contactPhoneHref: null,
  contactEmail: null,
  contactAddress: null,
  contactHours: null,
  contactMapLat: null,
  contactMapLng: null,
  contactMapZoom: null,
  socialTelegram: null,
  socialWhatsapp: null,
  socialVk: null,
  reqFullName: null,
  reqShortName: null,
  reqInn: null,
  reqOgrnip: null,
  reqLegalAddress: null,
  reqActualAddress: null,
  reqPhone: null,
  reqEmail: null,
  reqSite: null,
  reqBankDetails: null,
  cdekEnv: null,
  cdekSenderCityCode: null,
  cdekSenderPostalCode: null,
  cdekSenderAddress: null,
  cdekSenderName: null,
  cdekSenderPhone: null,
  cdekTariffDoor: null,
  cdekTariffPvz: null,
  cdekDefaultWeightGrams: null,
  cdekDefaultLengthCm: null,
  cdekDefaultWidthCm: null,
  cdekDefaultHeightCm: null,
  yookassaVatCode: null,
  yookassaVerifyIp: null,
  updatedAt: null,
})

const toIso = (value: Date | string | null): string | null => {
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

const mapCdekEnv = (value: string | null): 'test' | 'production' | null => {
  if (value === 'test' || value === 'production') return value
  return null
}

const rowToDto = (row: SiteSettingsRow): SiteSettingsDto => ({
  contactPhoneDisplay: row.contact_phone_display,
  contactPhoneHref: row.contact_phone_href,
  contactEmail: row.contact_email,
  contactAddress: row.contact_address,
  contactHours: row.contact_hours,
  contactMapLat: row.contact_map_lat,
  contactMapLng: row.contact_map_lng,
  contactMapZoom: row.contact_map_zoom,
  socialTelegram: row.social_telegram,
  socialWhatsapp: row.social_whatsapp,
  socialVk: row.social_vk,
  reqFullName: row.req_full_name,
  reqShortName: row.req_short_name,
  reqInn: row.req_inn,
  reqOgrnip: row.req_ogrnip,
  reqLegalAddress: row.req_legal_address,
  reqActualAddress: row.req_actual_address,
  reqPhone: row.req_phone,
  reqEmail: row.req_email,
  reqSite: row.req_site,
  reqBankDetails: row.req_bank_details,
  cdekEnv: mapCdekEnv(row.cdek_env),
  cdekSenderCityCode: row.cdek_sender_city_code,
  cdekSenderPostalCode: row.cdek_sender_postal_code,
  cdekSenderAddress: row.cdek_sender_address,
  cdekSenderName: row.cdek_sender_name,
  cdekSenderPhone: row.cdek_sender_phone,
  cdekTariffDoor: row.cdek_tariff_door,
  cdekTariffPvz: row.cdek_tariff_pvz,
  cdekDefaultWeightGrams: row.cdek_default_weight_grams,
  cdekDefaultLengthCm: row.cdek_default_length_cm,
  cdekDefaultWidthCm: row.cdek_default_width_cm,
  cdekDefaultHeightCm: row.cdek_default_height_cm,
  yookassaVatCode: row.yookassa_vat_code,
  yookassaVerifyIp: row.yookassa_verify_ip,
  updatedAt: toIso(row.updated_at),
})

const SELECT_COLUMNS = `
  contact_phone_display, contact_phone_href, contact_email, contact_address, contact_hours,
  contact_map_lat, contact_map_lng, contact_map_zoom,
  social_telegram, social_whatsapp, social_vk,
  req_full_name, req_short_name, req_inn, req_ogrnip,
  req_legal_address, req_actual_address, req_phone, req_email, req_site, req_bank_details,
  cdek_env, cdek_sender_city_code, cdek_sender_postal_code, cdek_sender_address,
  cdek_sender_name, cdek_sender_phone, cdek_tariff_door, cdek_tariff_pvz,
  cdek_default_weight_grams, cdek_default_length_cm, cdek_default_width_cm, cdek_default_height_cm,
  yookassa_vat_code, yookassa_verify_ip,
  updated_at
`

export const getSiteSettings = async (): Promise<SiteSettingsDto> => {
  const result = await pool.query<SiteSettingsRow>(
    `SELECT ${SELECT_COLUMNS} FROM site_settings WHERE id = $1`,
    [SETTINGS_ID],
  )
  const row = result.rows[0]
  if (!row) return nullSettings()
  return rowToDto(row)
}

export const getPublicSiteContacts = async (): Promise<PublicSiteContacts> => {
  const settings = await getSiteSettings()
  return {
    contactPhoneDisplay: settings.contactPhoneDisplay,
    contactPhoneHref: settings.contactPhoneHref,
    contactEmail: settings.contactEmail,
    contactAddress: settings.contactAddress,
    contactHours: settings.contactHours,
    contactMapLat: settings.contactMapLat,
    contactMapLng: settings.contactMapLng,
    contactMapZoom: settings.contactMapZoom,
    socialTelegram: settings.socialTelegram,
    socialWhatsapp: settings.socialWhatsapp,
    socialVk: settings.socialVk,
  }
}

export const getPublicRequisites = async (): Promise<PublicRequisites> => {
  const settings = await getSiteSettings()
  return {
    reqFullName: settings.reqFullName,
    reqShortName: settings.reqShortName,
    reqInn: settings.reqInn,
    reqOgrnip: settings.reqOgrnip,
    reqLegalAddress: settings.reqLegalAddress,
    reqActualAddress: settings.reqActualAddress,
    reqPhone: settings.reqPhone,
    reqEmail: settings.reqEmail,
    reqSite: settings.reqSite,
    reqBankDetails: settings.reqBankDetails,
  }
}

export const updateContactSettings = async (
  input: ContactSettingsInput,
): Promise<SiteSettingsDto> => {
  await pool.query(
    `UPDATE site_settings SET
      contact_phone_display = $1,
      contact_phone_href = $2,
      contact_email = $3,
      contact_address = $4,
      contact_hours = $5,
      contact_map_lat = $6,
      contact_map_lng = $7,
      contact_map_zoom = $8,
      social_telegram = $9,
      social_whatsapp = $10,
      social_vk = $11,
      updated_at = NOW()
     WHERE id = $12`,
    [
      input.contactPhoneDisplay,
      input.contactPhoneHref,
      input.contactEmail,
      input.contactAddress,
      input.contactHours,
      input.contactMapLat,
      input.contactMapLng,
      input.contactMapZoom,
      input.socialTelegram,
      input.socialWhatsapp,
      input.socialVk,
      SETTINGS_ID,
    ],
  )

  return getSiteSettings()
}

export const updateRequisitesSettings = async (
  input: RequisitesSettingsInput,
): Promise<SiteSettingsDto> => {
  await pool.query(
    `UPDATE site_settings SET
      req_full_name = $1,
      req_short_name = $2,
      req_inn = $3,
      req_ogrnip = $4,
      req_legal_address = $5,
      req_actual_address = $6,
      req_phone = $7,
      req_email = $8,
      req_site = $9,
      req_bank_details = $10,
      updated_at = NOW()
     WHERE id = $11`,
    [
      input.reqFullName,
      input.reqShortName,
      input.reqInn,
      input.reqOgrnip,
      input.reqLegalAddress,
      input.reqActualAddress,
      input.reqPhone,
      input.reqEmail,
      input.reqSite,
      input.reqBankDetails,
      SETTINGS_ID,
    ],
  )

  return getSiteSettings()
}

export const updateCdekSettings = async (input: CdekSettingsInput): Promise<SiteSettingsDto> => {
  const cdekEnv = input.cdekEnv === undefined ? null : input.cdekEnv
  if (cdekEnv === 'production' && (!env.cdek.clientId || !env.cdek.clientSecret)) {
    throw new HttpError(
      422,
      'Для режима production нужны серверные ключи CDEK (CDEK_CLIENT_ID/SECRET).',
      'VALIDATION',
    )
  }

  await pool.query(
    `UPDATE site_settings SET
      cdek_env = $1,
      cdek_sender_city_code = $2,
      cdek_sender_postal_code = $3,
      cdek_sender_address = $4,
      cdek_sender_name = $5,
      cdek_sender_phone = $6,
      cdek_tariff_door = $7,
      cdek_tariff_pvz = $8,
      cdek_default_weight_grams = $9,
      cdek_default_length_cm = $10,
      cdek_default_width_cm = $11,
      cdek_default_height_cm = $12,
      updated_at = NOW()
     WHERE id = $13`,
    [
      cdekEnv,
      input.cdekSenderCityCode ?? null,
      input.cdekSenderPostalCode ?? null,
      input.cdekSenderAddress ?? null,
      input.cdekSenderName ?? null,
      input.cdekSenderPhone ?? null,
      input.cdekTariffDoor ?? null,
      input.cdekTariffPvz ?? null,
      input.cdekDefaultWeightGrams ?? null,
      input.cdekDefaultLengthCm ?? null,
      input.cdekDefaultWidthCm ?? null,
      input.cdekDefaultHeightCm ?? null,
      SETTINGS_ID,
    ],
  )

  invalidateRuntimeConfigCache()
  return getSiteSettings()
}

export const updateYookassaSettings = async (
  input: YookassaSettingsInput,
): Promise<SiteSettingsDto> => {
  await pool.query(
    `UPDATE site_settings SET
      yookassa_vat_code = $1,
      yookassa_verify_ip = $2,
      updated_at = NOW()
     WHERE id = $3`,
    [
      input.yookassaVatCode ?? null,
      input.yookassaVerifyIp === undefined ? null : input.yookassaVerifyIp,
      SETTINGS_ID,
    ],
  )

  invalidateRuntimeConfigCache()
  return getSiteSettings()
}

export type IntegrationsStatus = {
  cdekConfigured: boolean
  yookassaConfigured: boolean
  yookassaWebConfigured: boolean
  yookassaShopId: string
  yookassaWebShopId: string
}

export const getIntegrationsStatus = (): IntegrationsStatus => ({
  cdekConfigured: Boolean(env.cdek.clientId && env.cdek.clientSecret),
  yookassaConfigured: Boolean(env.yookassa.shopId && env.yookassa.secretKey),
  yookassaWebConfigured: Boolean(env.yookassa.webShopId && env.yookassa.webSecretKey),
  yookassaShopId: env.yookassa.shopId,
  yookassaWebShopId: env.yookassa.webShopId,
})
