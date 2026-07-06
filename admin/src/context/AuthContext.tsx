import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { ApiError } from '../lib/api'
import { fetchMe, login as authLogin, logout as authLogout } from '../lib/auth'
import type { AdminMe } from '../lib/auth'

type AuthContextValue = {
  admin: AdminMe | null
  loading: boolean
  login: (email: string, password: string) => Promise<AdminMe>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [admin, setAdmin] = useState<AdminMe | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const hydrateSession = async () => {
      try {
        const me = await fetchMe()
        if (mounted) setAdmin(me)
      } catch (error) {
        if (mounted) {
          if (error instanceof ApiError && error.status === 401) {
            setAdmin(null)
          } else {
            setAdmin(null)
          }
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void hydrateSession()

    return () => {
      mounted = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const me = await authLogin(email, password)
    setAdmin(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    try {
      await authLogout()
    } finally {
      setAdmin(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      admin,
      loading,
      login,
      logout,
    }),
    [admin, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
