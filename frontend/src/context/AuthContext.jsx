import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { setUnauthorizedHandler, tokenStore } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState(null)
  // 'checking' while we validate a stored token on first load.
  const [status, setStatus] = useState(tokenStore.get() ? 'checking' : 'anonymous')

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setStatus('anonymous')
    queryClient.clear()
    navigate('/login', { replace: true })
  }, [navigate, queryClient])

  // On any 401: clear the token and go to /login (section 11).
  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  useEffect(() => {
    if (status !== 'checking') return
    authApi
      .me()
      .then((u) => {
        setUser(u)
        setStatus('authenticated')
      })
      .catch(() => {
        // A 401 already ran logout(); for network errors keep the token and let the user retry.
        if (tokenStore.get()) setStatus('error')
      })
  }, [status])

  const handleAuth = useCallback((data) => {
    tokenStore.set(data.access_token)
    queryClient.clear()
    setUser(data.user)
    setStatus('authenticated')
  }, [queryClient])

  const value = useMemo(
    () => ({
      user,
      status,
      login: async (body) => handleAuth(await authApi.login(body)),
      register: async (body) => handleAuth(await authApi.register(body)),
      logout,
      retry: () => setStatus('checking'),
    }),
    [user, status, handleAuth, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
