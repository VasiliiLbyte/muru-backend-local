export type NameParts = {
  lastName: string
  firstName: string
  middleName: string
}

export const splitFullName = (fullName: string): NameParts => {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    return { lastName: '', firstName: '', middleName: '' }
  }
  if (tokens.length === 1) {
    return { lastName: '', firstName: tokens[0]!, middleName: '' }
  }
  if (tokens.length === 2) {
    return { lastName: tokens[0]!, firstName: tokens[1]!, middleName: '' }
  }
  return {
    lastName: tokens[0]!,
    firstName: tokens[1]!,
    middleName: tokens.slice(2).join(' '),
  }
}

export const joinNameParts = (parts: NameParts): string =>
  [parts.lastName, parts.firstName, parts.middleName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')

export const resolveNameParts = (input: {
  lastName?: string | null
  firstName?: string | null
  middleName?: string | null
  fullName?: string | null
}): NameParts => {
  const lastName = (input.lastName ?? '').trim()
  const firstName = (input.firstName ?? '').trim()
  const middleName = (input.middleName ?? '').trim()

  if (lastName && firstName) {
    return { lastName, firstName, middleName }
  }

  const fullName = (input.fullName ?? '').trim()
  if (fullName) {
    return splitFullName(fullName)
  }

  const err = new Error('Name is required') as Error & { status?: number; code?: string }
  err.status = 400
  err.code = 'VALIDATION'
  throw err
}
