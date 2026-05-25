import type { Response } from 'express'
import { describe, expect, it } from 'vitest'

import { fail, HttpError, ok } from './api-response'

const mockRes = () => {
  const state: { statusCode: number; body: unknown } = { statusCode: 200, body: null }
  const res = {
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(body: unknown) {
      state.body = body
      return res
    },
  } as unknown as Response
  return { res, state }
}

describe('ok', () => {
  it('returns success envelope with error null', () => {
    const { res, state } = mockRes()
    ok(res, { id: 1 })
    expect(state.statusCode).toBe(200)
    expect(state.body).toEqual({ success: true, data: { id: 1 }, error: null })
  })

  it('supports custom status', () => {
    const { res, state } = mockRes()
    ok(res, { created: true }, 201)
    expect(state.statusCode).toBe(201)
  })
})

describe('fail', () => {
  it('returns error envelope with data null', () => {
    const { res, state } = mockRes()
    fail(res, 404, 'Not found', 'NOT_FOUND')
    expect(state.statusCode).toBe(404)
    expect(state.body).toEqual({
      success: false,
      data: null,
      error: { message: 'Not found', code: 'NOT_FOUND', details: undefined },
    })
  })
})

describe('HttpError', () => {
  it('carries status, code, and details', () => {
    const err = new HttpError(400, 'Bad input', 'VALIDATION', [{ path: ['x'] }])
    expect(err.status).toBe(400)
    expect(err.code).toBe('VALIDATION')
    expect(err.details).toEqual([{ path: ['x'] }])
    expect(err.message).toBe('Bad input')
  })
})
