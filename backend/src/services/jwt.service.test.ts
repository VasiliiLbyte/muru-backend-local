import { describe, expect, it, vi } from 'vitest'

vi.mock('../utils/env', () => ({
  env: {
    jwtSecret: 'telegram_jwt_secret_for_tests_0123456789ab',
  },
}))

import { signJwt, verifyJwt } from './jwt.service'

describe('jwt.service', () => {
  it('round-trips HS256 tokens', () => {
    const token = signJwt({ userId: 1, telegramId: 42 })
    expect(verifyJwt(token)).toMatchObject({ userId: 1, telegramId: 42 })
  })

  it('rejects alg=none forged token', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ userId: 1, telegramId: 42 })).toString('base64url')
    expect(verifyJwt(`${header}.${payload}.`)).toBeNull()
  })
})
