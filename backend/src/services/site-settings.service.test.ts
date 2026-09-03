import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    cdek: {
      clientId: 'cdek-client',
      clientSecret: 'cdek-secret-VALUE',
      webhookSecret: 'cdek-webhook-VALUE',
    },
    yookassa: {
      shopId: 'shop-123',
      secretKey: 'yk-secret-KEY-VALUE',
      webShopId: 'web-shop-456',
      webSecretKey: 'yk-web-secret-KEY-VALUE',
    },
  },
}))

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

const mockPoolQuery = vi.fn()
const mockClientQuery = vi.fn()
const mockClientRelease = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
    connect: async () => ({
      query: (...args: unknown[]) => mockClientQuery(...args),
      release: () => mockClientRelease(),
    }),
  },
}))

vi.mock('./runtime-config.service', () => ({
  invalidateRuntimeConfigCache: vi.fn(),
}))

import { HttpError } from '../utils/api-response'
import {
  getIntegrationsStatus,
  getPublicRequisites,
  getPublicSiteContacts,
  getSiteSettings,
  updateCdekSettings,
  updateContactSettings,
  updateRequisitesSettings,
  updateYookassaSettings,
  updateCatalogPlaceholderSettings,
} from './site-settings.service'
import { invalidateRuntimeConfigCache } from './runtime-config.service'

const fullRow = {
  contact_phone_display: '+7 (999) 000-00-00',
  contact_phone_href: 'tel:+79990000000',
  contact_email: 'shop@example.com',
  contact_address: 'Москва',
  contact_hours: '10–20',
  contact_map_lat: 55.75,
  contact_map_lng: 37.62,
  contact_map_zoom: 14,
  social_telegram: 'https://t.me/example',
  social_whatsapp: null,
  social_vk: null,
  req_full_name: 'ИП Пример',
  req_short_name: 'Пример',
  req_inn: '123456789012',
  req_ogrnip: null,
  req_legal_address: null,
  req_actual_address: null,
  req_phone: null,
  req_email: null,
  req_site: null,
  req_bank_details: null,
  cdek_env: null,
  cdek_sender_city_code: null,
  cdek_sender_postal_code: null,
  cdek_sender_address: null,
  cdek_sender_name: null,
  cdek_sender_phone: null,
  cdek_tariff_door: null,
  cdek_tariff_pvz: null,
  cdek_default_weight_grams: null,
  cdek_default_length_cm: null,
  cdek_default_width_cm: null,
  cdek_default_height_cm: null,
  yookassa_vat_code: null,
  yookassa_verify_ip: null,
  catalog_placeholder_image_url: null,
  updated_at: new Date('2026-08-01T00:00:00.000Z'),
}

const nullCdekYk = {
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
  catalogPlaceholderImageUrl: null,
}

describe('site-settings.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.cdek.clientId = 'cdek-client'
    mockEnv.cdek.clientSecret = 'cdek-secret-VALUE'
  })

  it('getSiteSettings returns all-null defaults when no row', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })
    const settings = await getSiteSettings()
    expect(settings).toEqual({
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
      ...nullCdekYk,
      updatedAt: null,
    })
  })

  it('updateContactSettings updates only contact/social columns and returns fresh data', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({
        rows: [
          {
            ...fullRow,
            contact_phone_display: '+7 111',
            contact_email: 'new@example.com',
            req_full_name: 'ИП Пример',
          },
        ],
      })

    const result = await updateContactSettings({
      contactPhoneDisplay: '+7 111',
      contactPhoneHref: 'tel:+7111',
      contactEmail: 'new@example.com',
      contactAddress: null,
      contactHours: null,
      contactMapLat: 1,
      contactMapLng: 2,
      contactMapZoom: 10,
      socialTelegram: 'https://t.me/x',
      socialWhatsapp: null,
      socialVk: null,
    })

    const updateSql = String(mockPoolQuery.mock.calls[0][0])
    expect(updateSql).toContain('contact_phone_display')
    expect(updateSql).toContain('social_telegram')
    expect(updateSql).not.toContain('req_full_name')
    expect(updateSql).not.toContain('req_inn')
    expect(mockPoolQuery.mock.calls[0][1]).toEqual([
      '+7 111',
      'tel:+7111',
      'new@example.com',
      null,
      null,
      1,
      2,
      10,
      'https://t.me/x',
      null,
      null,
      1,
    ])
    expect(result.contactPhoneDisplay).toBe('+7 111')
    expect(result.contactEmail).toBe('new@example.com')
    expect(result.reqFullName).toBe('ИП Пример')
  })

  it('getPublicSiteContacts omits requisites keys', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [fullRow] })
    const publicContacts = await getPublicSiteContacts()
    expect(publicContacts).toEqual({
      contactPhoneDisplay: '+7 (999) 000-00-00',
      contactPhoneHref: 'tel:+79990000000',
      contactEmail: 'shop@example.com',
      contactAddress: 'Москва',
      contactHours: '10–20',
      contactMapLat: 55.75,
      contactMapLng: 37.62,
      contactMapZoom: 14,
      socialTelegram: 'https://t.me/example',
      socialWhatsapp: null,
      socialVk: null,
    })
    expect(Object.keys(publicContacts).some((k) => k.startsWith('req'))).toBe(false)
    expect(publicContacts).not.toHaveProperty('reqFullName')
    expect(publicContacts).not.toHaveProperty('updatedAt')
  })

  it('getPublicRequisites returns only req_* fields', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [fullRow] })
    const publicRequisites = await getPublicRequisites()
    expect(publicRequisites).toEqual({
      reqFullName: 'ИП Пример',
      reqShortName: 'Пример',
      reqInn: '123456789012',
      reqOgrnip: null,
      reqLegalAddress: null,
      reqActualAddress: null,
      reqPhone: null,
      reqEmail: null,
      reqSite: null,
      reqBankDetails: null,
    })
    expect(Object.keys(publicRequisites).every((k) => k.startsWith('req'))).toBe(true)
    expect(publicRequisites).not.toHaveProperty('contactPhoneDisplay')
    expect(publicRequisites).not.toHaveProperty('socialTelegram')
    expect(publicRequisites).not.toHaveProperty('updatedAt')
  })

  it('updateRequisitesSettings updates only req_* columns', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...fullRow,
            req_full_name: 'ИП Новое',
            contact_phone_display: '+7 (999) 000-00-00',
          },
        ],
      })

    const result = await updateRequisitesSettings({
      reqFullName: 'ИП Новое',
      reqShortName: 'Новое',
      reqInn: '000',
      reqOgrnip: null,
      reqLegalAddress: null,
      reqActualAddress: null,
      reqPhone: null,
      reqEmail: 'req@example.com',
      reqSite: null,
      reqBankDetails: null,
    })

    const updateSql = String(mockPoolQuery.mock.calls[0][0])
    expect(updateSql).toContain('req_full_name')
    expect(updateSql).toContain('req_bank_details')
    expect(updateSql).not.toContain('contact_phone_display')
    expect(updateSql).not.toContain('social_telegram')
    expect(result.reqFullName).toBe('ИП Новое')
    expect(result.contactPhoneDisplay).toBe('+7 (999) 000-00-00')
  })

  it('updateCdekSettings production without keys → 422', async () => {
    mockEnv.cdek.clientId = ''
    mockEnv.cdek.clientSecret = ''
    await expect(
      updateCdekSettings({
        cdekEnv: 'production',
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
      }),
    ).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('production'),
    } satisfies Partial<HttpError>)
    expect(mockPoolQuery).not.toHaveBeenCalled()
  })

  it('updateCdekSettings succeeds and invalidates cache', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...fullRow, cdek_env: 'test', cdek_sender_city_code: 44 }],
      })

    const result = await updateCdekSettings({
      cdekEnv: 'test',
      cdekSenderCityCode: 44,
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
    })

    expect(result.cdekEnv).toBe('test')
    expect(result.cdekSenderCityCode).toBe(44)
    expect(invalidateRuntimeConfigCache).toHaveBeenCalled()
  })

  it('updateYookassaSettings persists vat/verifyIp and invalidates cache', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...fullRow, yookassa_vat_code: 4, yookassa_verify_ip: false }],
      })

    const result = await updateYookassaSettings({
      yookassaVatCode: 4,
      yookassaVerifyIp: false,
    })
    expect(result.yookassaVatCode).toBe(4)
    expect(result.yookassaVerifyIp).toBe(false)
    expect(invalidateRuntimeConfigCache).toHaveBeenCalled()
  })

  it('updateCatalogPlaceholderSettings persists URL and returns DTO', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ catalog_placeholder_image_url: null }],
      }) // SELECT old
      .mockResolvedValueOnce({ rows: [] }) // UPDATE site_settings
      .mockResolvedValueOnce({ rows: [] }) // COMMIT
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          ...fullRow,
          catalog_placeholder_image_url: '/uploads/catalog-placeholder.webp',
        },
      ],
    })

    const result = await updateCatalogPlaceholderSettings({
      catalogPlaceholderImageUrl: '/uploads/catalog-placeholder.webp',
    })
    expect(result.catalogPlaceholderImageUrl).toBe('/uploads/catalog-placeholder.webp')
    expect(mockClientRelease).toHaveBeenCalled()
  })

  it('updateCatalogPlaceholderSettings backfills products when placeholder URL changes', async () => {
    const oldUrl = '/uploads/old-placeholder.webp'
    const newUrl = '/uploads/new-placeholder.webp'

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ catalog_placeholder_image_url: oldUrl }],
      }) // SELECT old
      .mockResolvedValueOnce({ rows: [] }) // UPDATE site_settings
      .mockResolvedValueOnce({ rows: [] }) // UPDATE products backfill
      .mockResolvedValueOnce({ rows: [] }) // COMMIT
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ ...fullRow, catalog_placeholder_image_url: newUrl }],
    })

    await updateCatalogPlaceholderSettings({
      catalogPlaceholderImageUrl: newUrl,
    })

    expect(mockClientQuery).toHaveBeenCalledTimes(5)

    const beginSql = String(mockClientQuery.mock.calls[0][0])
    expect(beginSql).toBe('BEGIN')

    const selectSql = String(mockClientQuery.mock.calls[1][0])
    expect(selectSql).toContain('SELECT catalog_placeholder_image_url')

    const updateSettingsSql = String(mockClientQuery.mock.calls[2][0])
    expect(updateSettingsSql).toContain('UPDATE site_settings')

    const backfillSql = String(mockClientQuery.mock.calls[3][0])
    expect(backfillSql).toContain('UPDATE products')
    expect(backfillSql).toContain("image_url_1 = ''")
    expect(mockClientQuery.mock.calls[3][1]).toEqual([oldUrl])

    const commitSql = String(mockClientQuery.mock.calls[4][0])
    expect(commitSql).toBe('COMMIT')

    expect(mockClientRelease).toHaveBeenCalled()
  })

  it('updateCatalogPlaceholderSettings skips backfill when URL unchanged', async () => {
    const sameUrl = '/uploads/same.webp'

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ catalog_placeholder_image_url: sameUrl }],
      }) // SELECT old
      .mockResolvedValueOnce({ rows: [] }) // UPDATE site_settings
      .mockResolvedValueOnce({ rows: [] }) // COMMIT
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ ...fullRow, catalog_placeholder_image_url: sameUrl }],
    })

    await updateCatalogPlaceholderSettings({
      catalogPlaceholderImageUrl: sameUrl,
    })

    expect(mockClientQuery).toHaveBeenCalledTimes(4)
    const allSqls = mockClientQuery.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(allSqls).not.toContain(expect.stringContaining('UPDATE products'))
    expect(mockClientRelease).toHaveBeenCalled()
  })

  it('getIntegrationsStatus returns booleans + shop ids, never secrets', () => {
    const status = getIntegrationsStatus()
    expect(status).toEqual({
      cdekConfigured: true,
      yookassaConfigured: true,
      yookassaWebConfigured: true,
      yookassaShopId: 'shop-123',
      yookassaWebShopId: 'web-shop-456',
    })
    const json = JSON.stringify(status)
    expect(json).not.toContain('cdek-secret-VALUE')
    expect(json).not.toContain('yk-secret-KEY-VALUE')
    expect(json).not.toContain('yk-web-secret-KEY-VALUE')
    expect(json).not.toContain('cdek-webhook-VALUE')
    expect(json).not.toContain('clientSecret')
    expect(json).not.toContain('secretKey')
    expect(json).not.toContain('webhookSecret')
  })

  it('serialized public/GET site payloads never contain secret substrings', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [fullRow] })
    const site = await getSiteSettings()
    const contacts = await getPublicSiteContacts()
    const requisites = await getPublicRequisites()
    const blob = JSON.stringify({ site, contacts, requisites, status: getIntegrationsStatus() })
    expect(blob).not.toContain('cdek-secret-VALUE')
    expect(blob).not.toContain('yk-secret-KEY-VALUE')
    expect(blob).not.toContain('yk-web-secret-KEY-VALUE')
    expect(blob).not.toContain('cdek-webhook-VALUE')
    expect(site).not.toHaveProperty('clientSecret')
    expect(site).not.toHaveProperty('secretKey')
    expect(site).not.toHaveProperty('webhookSecret')
  })
})
