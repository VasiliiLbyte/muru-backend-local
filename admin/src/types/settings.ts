/** Mirrors backend site-settings DTO (camelCase). */

export type ContactSettingsInput = {
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

export type RequisitesSettingsInput = {
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

export type CdekSettingsInput = {
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
}

export type YookassaSettingsInput = {
  yookassaVatCode: number | null
  yookassaVerifyIp: boolean | null
}

export type IntegrationsStatus = {
  cdekConfigured: boolean
  yookassaConfigured: boolean
  yookassaWebConfigured: boolean
  yookassaShopId: string
  yookassaWebShopId: string
}

export type SiteSettingsDto = ContactSettingsInput &
  RequisitesSettingsInput &
  CdekSettingsInput &
  YookassaSettingsInput & {
    updatedAt: string | null
  }
