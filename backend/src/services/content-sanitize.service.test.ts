import { describe, expect, it } from 'vitest'

import { sanitizeContentHtml } from './content-sanitize.service'

describe('sanitizeContentHtml', () => {
  it('strips script tags and event handlers', () => {
    const input = '<p>Hello</p><script>alert(1)</script><img src=x onerror=alert(1)>'
    const result = sanitizeContentHtml(input)
    expect(result).not.toContain('<script')
    expect(result).not.toContain('onerror')
    expect(result).toContain('<p>Hello</p>')
  })

  it('keeps allowed formatting tags', () => {
    const input =
      '<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>one</li></ul>'
    expect(sanitizeContentHtml(input)).toBe(input)
  })

  it('keeps safe links and images', () => {
    const input = '<p><a href="https://murushop.ru">Shop</a></p><img src="/uploads/a.jpg" alt="A">'
    const result = sanitizeContentHtml(input)
    expect(result).toContain('href="https://murushop.ru"')
    expect(result).toContain('src="/uploads/a.jpg"')
    expect(result).toContain('alt="A"')
  })
})
