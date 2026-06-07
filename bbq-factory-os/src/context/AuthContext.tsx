import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Role = 'master' | 'driver' | 'admin'

export interface User {
  tid: number
  name: string
  role: Role
}

interface AuthCtx {
  user: User | null
  login:    (tid: number, pin: string) => Promise<void>
  register: (name: string, role: Role, pin: string) => Promise<User>
  logout:   () => void
  loading:  boolean
}

const AuthContext = createContext<AuthCtx | null>(null)
const STORAGE_KEY = 'bbq_user'

// Динамічний базовий URL для API
const AUTH_BASE = import.meta.env.VITE_API_URL ?? 
  (typeof window !== 'undefined' && window.location.hostname === 'test.wowusik.duckdns.org'
    ? `${window.location.protocol}//api-test.wowusik.duckdns.org`
    : '');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setUser(JSON.parse(saved))
    } catch {}
    setLoading(false)
  }, [])

  const login = async (tid: number, pin: string) => {
    const res = await fetch(`${AUTH_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tid, pin_code: pin }),
    })
    if (!res.ok) throw new Error('Невірний пін-код')
    const u: User = await res.json()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    setUser(u)
  }

  const register = async (name: string, role: Role, pin: string): Promise<User> => {
    const res = await fetch(`${AUTH_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, pin_code: pin }),
    })
    if (!res.ok) {
      let msg = 'Помилка реєстрації'
      try {
        const err = await res.json()
        if (typeof err.detail === 'string') msg = err.detail
        else if (Array.isArray(err.detail)) msg = err.detail.map((e: any) => e.msg || e.detail || 'Error').join(', ')
        else if (typeof err.detail === 'object') msg = JSON.stringify(err.detail)
      } catch {}
      throw new Error(msg)
    }
    const u: User = await res.json()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
