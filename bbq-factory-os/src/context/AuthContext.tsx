import { createContext, useContext, useState, ReactNode } from 'react'

export type Role = 'admin' | 'master' | 'driver'

interface User {
  name: string
  email: string
  role: Role
  avatar: string
  cycleId: number
}

interface AuthCtx {
  user: User | null
  login: (email: string, password: string, role: Role) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

// ─── DEMO USERS (замінити на API пізніше) ────────────────────────────────────
const DEMO_USERS: Record<Role, User> = {
  admin:  { name: 'Олексій Коваль',    email: 'admin@bbq.ua',  role: 'admin',  avatar: 'ОК', cycleId: 12 },
  master: { name: 'Микола Бондаренко', email: 'master@bbq.ua', role: 'master', avatar: 'МБ', cycleId: 12 },
  driver: { name: 'Сергій Левченко',   email: 'driver@bbq.ua', role: 'driver', avatar: 'СЛ', cycleId: 12 },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const login = async (_email: string, _password: string, role: Role) => {
    // TODO: замінити на реальний API запит
    // const res = await fetch('/api/auth/login', { method:'POST', body: JSON.stringify({email, password}) })
    // const data = await res.json()
    // setUser(data.user)
    setUser(DEMO_USERS[role])
  }

  const logout = () => setUser(null)

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
