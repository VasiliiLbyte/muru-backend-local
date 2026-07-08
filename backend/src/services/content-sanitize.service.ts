import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  'p',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'a',
  'img',
  'br',
  'blockquote',
]

export const sanitizeContentHtml = (html: string): string =>
  sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href'],
      img: ['src', 'alt'],
    },
    disallowedTagsMode: 'discard',
  })
