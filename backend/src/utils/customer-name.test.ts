import { describe, expect, it } from 'vitest'

import { joinNameParts, resolveNameParts, splitFullName } from './customer-name'

describe('splitFullName', () => {
  it('splits empty / whitespace to empty parts', () => {
    expect(splitFullName('')).toEqual({ lastName: '', firstName: '', middleName: '' })
    expect(splitFullName('   ')).toEqual({ lastName: '', firstName: '', middleName: '' })
  })

  it('maps single token to firstName', () => {
    expect(splitFullName('Иван')).toEqual({ lastName: '', firstName: 'Иван', middleName: '' })
  })

  it('maps two tokens to last + first', () => {
    expect(splitFullName('Иванов Иван')).toEqual({
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: '',
    })
  })

  it('maps three tokens to last + first + middle', () => {
    expect(splitFullName('Иванов Иван Петрович')).toEqual({
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Петрович',
    })
  })

  it('joins remaining tokens into middleName', () => {
    expect(splitFullName('Иванов Иван Петрович Львович')).toEqual({
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Петрович Львович',
    })
  })
})

describe('joinNameParts', () => {
  it('joins non-empty trimmed parts with spaces', () => {
    expect(joinNameParts({ lastName: 'Иванов', firstName: 'Иван', middleName: 'Петрович' })).toBe(
      'Иванов Иван Петрович',
    )
    expect(joinNameParts({ lastName: '', firstName: 'Иван', middleName: '' })).toBe('Иван')
    expect(joinNameParts({ lastName: '  ', firstName: '', middleName: '' })).toBe('')
  })
})

describe('resolveNameParts', () => {
  it('prefers lastName+firstName and ignores fullName', () => {
    expect(
      resolveNameParts({
        lastName: 'Сидоров',
        firstName: 'Пётр',
        middleName: 'Ильич',
        fullName: 'Иванов Иван',
      }),
    ).toEqual({ lastName: 'Сидоров', firstName: 'Пётр', middleName: 'Ильич' })
  })

  it('falls back to splitFullName for legacy fullName', () => {
    expect(resolveNameParts({ fullName: 'Иванов Иван Петрович' })).toEqual({
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Петрович',
    })
  })

  it('throws when neither parts nor fullName provided', () => {
    expect(() => resolveNameParts({})).toThrow(/Name is required/)
  })
})
