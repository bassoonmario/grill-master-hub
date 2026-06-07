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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Автологін при відкритті додатку
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setUser(JSON.parse(saved))
    } catch {}
    setLoading(false)
  }, [])

  const login = async (tid: number, pin: string) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
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
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, pin_code: pin }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Помилка реєстрації')
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

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
