import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyAdminJwt = vi.fn()
const mockGetSiteSettings = vi.fn()
const mockUpdateContactSettings = vi.fn()
const mockUpdateRequisitesSettings = vi.fn()
const mockUpdateCdekSettings = vi.fn()
const mockUpdateYookassaSettings = vi.fn()
const mockGetIntegrationsStatus = vi.fn()

vi.mock('../services/admin-auth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/admin-auth.service')>()
  return {
    ...actual,
    verifyAdminJwt: (...args: unknown[]) => mockVerifyAdminJwt(...args),
  }
})

vi.mock('../services/site-settings.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/site-settings.service')>()
  return {
    ...actual,
    getSiteSettings: (...args: unknown[]) => mockGetSiteSettings(...args),
    updateContactSettings: (...args: unknown[]) => mockUpdateContactSettings(...args),
    updateRequisitesSettings: (...args: unknown[]) => mockUpdateRequisitesSettings(...args),
    updateCdekSettings: (...args: unknown[]) => mockUpdateCdekSettings(...args),
    updateYookassaSettings: (...args: unknown[]) => mockUpdateYookassaSettings(...args),
    getIntegrationsStatus: (...args: unknown[]) => mockGetIntegrationsStatus(...args),
  }
})

import { errorHandler } from '../middleware/error-handler.middleware'
import { HttpError } from '../utils/api-response'
import { crmSettingsRouter } from '../routes/crm-settings.routes'

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/crm/settings', crmSettingsRouter)
  app.use(errorHandler)
  return app
}

const sampleSettings = {
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
}

describe('crm-settings.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminJwt.mockReturnValue({ adminId: 1, role: 'owner' })
  })

  it('returns 401 without cookie', async () => {
    const res = await request(buildApp()).get('/api/crm/settings/site')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('manager cookie → GET/PUT settings → 403', async () => {
    mockVerifyAdminJwt.mockReturnValue({ adminId: 2, role: 'manager' })
    const app = buildApp()

    const get = await request(app).get('/api/crm/settings/site').set('Cookie', 'admin_token=valid')
    expect(get.status).toBe(403)

    const putContacts = await request(app)
      .put('/api/crm/settings/site/contacts')
      .set('Cookie', 'admin_token=valid')
      .send({ contactEmail: 'a@b.com' })
    expect(putContacts.status).toBe(403)

    const putRequisites = await request(app)
      .put('/api/crm/settings/site/requisites')
      .set('Cookie', 'admin_token=valid')
      .send({ reqFullName: 'ИП' })
    expect(putRequisites.status).toBe(403)

    const putCdek = await request(app)
      .put('/api/crm/settings/cdek')
      .set('Cookie', 'admin_token=valid')
      .send({ cdekEnv: 'test' })
    expect(putCdek.status).toBe(403)

    const putYk = await request(app)
      .put('/api/crm/settings/yookassa')
      .set('Cookie', 'admin_token=valid')
      .send({ yookassaVatCode: 1 })
    expect(putYk.status).toBe(403)

    const integrations = await request(app)
      .get('/api/crm/settings/integrations-status')
      .set('Cookie', 'admin_token=valid')
    expect(integrations.status).toBe(403)

    expect(mockGetSiteSettings).not.toHaveBeenCalled()
    expect(mockUpdateContactSettings).not.toHaveBeenCalled()
    expect(mockUpdateRequisitesSettings).not.toHaveBeenCalled()
    expect(mockUpdateCdekSettings).not.toHaveBeenCalled()
    expect(mockUpdateYookassaSettings).not.toHaveBeenCalled()
    expect(mockGetIntegrationsStatus).not.toHaveBeenCalled()
  })

  it('owner GET /site → 200', async () => {
    mockGetSiteSettings.mockResolvedValueOnce(sampleSettings)
    const res = await request(buildApp())
      .get('/api/crm/settings/site')
      .set('Cookie', 'admin_token=valid')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(sampleSettings)
  })

  it('owner PUT /site/contacts → 200', async () => {
    mockUpdateContactSettings.mockResolvedValueOnce({
      ...sampleSettings,
      contactEmail: 'shop@example.com',
    })
    const res = await request(buildApp())
      .put('/api/crm/settings/site/contacts')
      .set('Cookie', 'admin_token=valid')
      .send({ contactEmail: 'shop@example.com' })
    expect(res.status).toBe(200)
    expect(res.body.data.contactEmail).toBe('shop@example.com')
    expect(mockUpdateContactSettings).toHaveBeenCalled()
  })

  it('owner PUT /site/requisites → 200', async () => {
    mockUpdateRequisitesSettings.mockResolvedValueOnce({
      ...sampleSettings,
      reqFullName: 'ИП Пример',
      reqInn: '123',
    })
    const res = await request(buildApp())
      .put('/api/crm/settings/site/requisites')
      .set('Cookie', 'admin_token=valid')
      .send({ reqFullName: 'ИП Пример', reqInn: '123' })
    expect(res.status).toBe(200)
    expect(res.body.data.reqFullName).toBe('ИП Пример')
    expect(mockUpdateRequisitesSettings).toHaveBeenCalled()
  })

  it('owner PUT /cdek → 200', async () => {
    mockUpdateCdekSettings.mockResolvedValueOnce({
      ...sampleSettings,
      cdekEnv: 'test',
      cdekSenderCityCode: 44,
    })
    const res = await request(buildApp())
      .put('/api/crm/settings/cdek')
      .set('Cookie', 'admin_token=valid')
      .send({ cdekEnv: 'test', cdekSenderCityCode: 44 })
    expect(res.status).toBe(200)
    expect(res.body.data.cdekEnv).toBe('test')
    expect(mockUpdateCdekSettings).toHaveBeenCalled()
  })

  it('owner PUT /cdek production without keys → 422', async () => {
    mockUpdateCdekSettings.mockRejectedValueOnce(
      new HttpError(422, 'Для режима production нужны серверные ключи CDEK.', 'VALIDATION'),
    )
    const res = await request(buildApp())
      .put('/api/crm/settings/cdek')
      .set('Cookie', 'admin_token=valid')
      .send({ cdekEnv: 'production' })
    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
  })

  it('owner PUT /yookassa → 200', async () => {
    mockUpdateYookassaSettings.mockResolvedValueOnce({
      ...sampleSettings,
      yookassaVatCode: 4,
      yookassaVerifyIp: false,
    })
    const res = await request(buildApp())
      .put('/api/crm/settings/yookassa')
      .set('Cookie', 'admin_token=valid')
      .send({ yookassaVatCode: 4, yookassaVerifyIp: false })
    expect(res.status).toBe(200)
    expect(res.body.data.yookassaVatCode).toBe(4)
    expect(mockUpdateYookassaSettings).toHaveBeenCalled()
  })

  it('owner GET /integrations-status → 200 without secrets', async () => {
    mockGetIntegrationsStatus.mockReturnValueOnce({
      cdekConfigured: true,
      yookassaConfigured: true,
      yookassaWebConfigured: false,
      yookassaShopId: 'shop-1',
      yookassaWebShopId: '',
    })
    const res = await request(buildApp())
      .get('/api/crm/settings/integrations-status')
      .set('Cookie', 'admin_token=valid')
    expect(res.status).toBe(200)
    expect(res.body.data.yookassaShopId).toBe('shop-1')
    const json = JSON.stringify(res.body)
    expect(json).not.toContain('clientSecret')
    expect(json).not.toContain('secretKey')
    expect(json).not.toContain('webhookSecret')
  })

  it('401 without cookie on new endpoints', async () => {
    const app = buildApp()
    expect((await request(app).put('/api/crm/settings/cdek').send({})).status).toBe(401)
    expect((await request(app).put('/api/crm/settings/yookassa').send({})).status).toBe(401)
    expect((await request(app).get('/api/crm/settings/integrations-status')).status).toBe(401)
  })
})
