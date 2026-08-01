import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/env', () => ({
  env: {
    cdek: {
      env: 'test',
      clientId: 'env-client-id',
      clientSecret: 'env-client-secret-VALUE',
      webhookSecret: 'env-webhook-secret-VALUE',
      senderCityCode: 137,
      senderPostalCode: '192102',
      senderAddress: 'env-address',
      senderName: 'env-name',
      senderPhone: '+79001112233',
      tariffDoor: 139,
      tariffPvz: 138,
    },
    yookassa: {
      vatCode: 1,
      verifyIp: true,
      shopId: 'env-shop',
      secretKey: 'env-secret-KEY-VALUE',
      webShopId: 'env-web-shop',
      webSecretKey: 'env-web-secret-KEY-VALUE',
      returnUrl: 'https://example.com/return',
      webReturnUrl: 'https://example.com/web-return',
      enabled: true,
    },
  },
}))

const mockPoolQuery = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
  },
}))

import {
  buildEffectiveConfigFromRow,
  getEffectiveConfig,
  invalidateRuntimeConfigCache,
} from './runtime-config.service'

describe('runtime-config.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateRuntimeConfigCache()
  })

  it('DB overrides env for non-secret fields; secrets always from env', () => {
    const cfg = buildEffectiveConfigFromRow({
      cdek_env: 'production',
      cdek_sender_city_code: 44,
      cdek_sender_postal_code: 'db-postal',
      cdek_sender_address: 'db-address',
      cdek_sender_name: 'db-name',
      cdek_sender_phone: '+79990001122',
      cdek_tariff_door: 200,
      cdek_tariff_pvz: 201,
      cdek_default_weight_grams: 1111,
      cdek_default_length_cm: 10,
      cdek_default_width_cm: 11,
      cdek_default_height_cm: 12,
      yookassa_vat_code: 4,
      yookassa_verify_ip: false,
    })

    expect(cfg.cdek.env).toBe('production')
    expect(cfg.cdek.senderCityCode).toBe(44)
    expect(cfg.cdek.tariffDoor).toBe(200)
    expect(cfg.cdek.defaultWeightGrams).toBe(1111)
    expect(cfg.yookassa.vatCode).toBe(4)
    expect(cfg.yookassa.verifyIp).toBe(false)

    expect(cfg.cdek.clientId).toBe('env-client-id')
    expect(cfg.cdek.clientSecret).toBe('env-client-secret-VALUE')
    expect(cfg.cdek.webhookSecret).toBe('env-webhook-secret-VALUE')
    expect(cfg.yookassa.secretKey).toBe('env-secret-KEY-VALUE')
    expect(cfg.yookassa.webSecretKey).toBe('env-web-secret-KEY-VALUE')
  })

  it('null DB row falls back to env / product defaults', () => {
    const cfg = buildEffectiveConfigFromRow(null)
    expect(cfg.cdek.env).toBe('test')
    expect(cfg.cdek.senderCityCode).toBe(137)
    expect(cfg.cdek.tariffDoor).toBe(139)
    expect(cfg.cdek.defaultWeightGrams).toBe(3000)
    expect(cfg.yookassa.vatCode).toBe(1)
    expect(cfg.yookassa.verifyIp).toBe(true)
  })

  it('getEffectiveConfig caches then refreshes after invalidate', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          cdek_env: null,
          cdek_sender_city_code: 999,
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
        },
      ],
    })
    const first = await getEffectiveConfig()
    expect(first.cdek.senderCityCode).toBe(999)
    expect(mockPoolQuery).toHaveBeenCalledTimes(1)

    const second = await getEffectiveConfig()
    expect(second.cdek.senderCityCode).toBe(999)
    expect(mockPoolQuery).toHaveBeenCalledTimes(1)

    invalidateRuntimeConfigCache()
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          cdek_env: null,
          cdek_sender_city_code: 1,
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
        },
      ],
    })
    const third = await getEffectiveConfig()
    expect(third.cdek.senderCityCode).toBe(1)
    expect(mockPoolQuery).toHaveBeenCalledTimes(2)
  })
})
