import { ReactNode, useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { BottomNav } from './BottomNav'
import { LogOut } from 'lucide-react'
import { api } from '@/lib/api'

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const [cycle, setCycle] = useState<string | null>(null)

  useEffect(() => {
    api.getCycle().then(r => setCycle(r.cycle)).catch(() => {})
  }, [])

  if (!user) return null

  const ROLE_LABELS = { admin: 'Адмін', master: 'Майстер', driver: 'Водій', office: 'Офіс' }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-wood.png")'
      }}
    >
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-surface border-b border-border flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-[22px] tracking-widest text-[var(--orange)]">Grills Factory</span>
          <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-[var(--orange-dim)] border border-[var(--orange-mid)] text-[var(--orange)] tracking-wider">
            ЦИКЛ {cycle ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-surface2 border border-border rounded-full px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-[var(--orange)] flex items-center justify-center text-[10px] font-bold text-black">
              {user.name.slice(0,2).toUpperCase()}
            </div>
            <span className="text-[13px] text-[var(--text-mid)]">{ROLE_LABELS[user.role]}</span>
          </div>
          <button
            onClick={logout}
            className="text-[var(--text-dim)] hover:text-[var(--red)] transition-colors bg-transparent border-none cursor-pointer p-1"
            title="Вийти"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24 px-2 pt-3 animate-fade-in">
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
