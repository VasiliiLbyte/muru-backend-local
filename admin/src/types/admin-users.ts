export type AdminUserRole = 'owner' | 'manager'

export type CrmUserDto = {
  id: number
  email: string
  role: AdminUserRole
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

export type CreateCrmUserBody = {
  email: string
  password: string
  role: AdminUserRole
}

export type PatchCrmUserBody = {
  role?: AdminUserRole
  is_active?: boolean
}

export const PASSWORD_MIN_LENGTH = 12
