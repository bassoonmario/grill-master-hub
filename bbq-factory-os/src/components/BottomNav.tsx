import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface NavItem {
  path: string
  icon: string
  label: string
  roles: string[]
  badge?: number
}

const COMMON_ITEMS: NavItem[] = [
  { path: '/',          icon: '🏠', label: 'Головна',  roles: ['admin','driver'] },
  { path: '/warehouse', icon: '📦', label: 'Склад',    roles: ['admin','driver'], badge: 2 },
  { path: '/tasks',     icon: '🔨', label: 'Завдання', roles: ['admin'] },
  { path: '/tasker',    icon: '🚚', label: 'Таскер',   roles: ['admin','driver'],          badge: 1 },
  { path: '/salary',    icon: '💰', label: 'Зарплата', roles: ['admin'] },
]

const MASTER_ITEMS: NavItem[] = [
  { path: '/master',    icon: '📊', label: 'Дашборд', roles: ['master'] },
  { path: '/balance',   icon: '⚖️', label: 'Баланс',   roles: ['master'] },
  { path: '/profile',   icon: '👤', label: 'Профіль',  roles: ['master'] },
]

const ALL_ITEMS = [...COMMON_ITEMS, ...MASTER_ITEMS]

export function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout, loading } = useAuth()
  const [showProfile, setShowProfile] = useState(false)

  if (loading || !user) {
    return <div className="fixed bottom-0 left-0 right-0 h-[64px] bg-black border-t border-white/5 z-50 flex items-center justify-center">
      <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
    </div>
  }

  const items = user.role === 'master' ? MASTER_ITEMS : COMMON_ITEMS.filter(i => i.roles.includes(user.role))

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50 flex shadow-[0_-4px_10px_rgba(0,0,0,0.3)]"
           style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {items.map(item => {
          const active = pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => {
                if (item.path === '/profile') {
                  setShowProfile(true)
                } else {
                  navigate(item.path)
                }
              }}
              className="flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1 relative border-none bg-transparent cursor-pointer transition-all duration-300 active:scale-95"
              style={{ color: active ? 'var(--orange)' : 'var(--text-dim)' }}
            >
              {item.badge && (
                <span className="absolute top-1 right-[calc(50%-18px)] bg-[var(--red)] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center font-mono">
                  {item.badge}
                </span>
              )}
              <span className="text-[22px] leading-none filter drop-shadow-sm">{item.icon}</span>
              <span className="text-[10px] font-mono tracking-wide uppercase font-bold">{item.label}</span>
              {active && (
                <span className="absolute top-0 left-1/4 right-1/4 h-1 rounded-b-full bg-[var(--orange)] shadow-[0_2px_10px_rgba(255,140,66,0.5)]" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowProfile(false)}>
          <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-[var(--orange)] to-yellow-500 rounded-full flex items-center justify-center text-3xl mb-4 shadow-xl shadow-orange-500/20">
                👤
              </div>
              <h2 className="text-2xl font-display text-white mb-1 uppercase tracking-tight">{user.name}</h2>
              <div className="bg-white/5 px-3 py-1 rounded-full border border-white/5 mb-6">
                <span className="font-mono text-[10px] text-[var(--orange)] font-bold uppercase tracking-widest">{user.role}</span>
              </div>
              
              <div className="w-full space-y-3">
                <button 
                  onClick={() => {
                    if (confirm('Ви впевнені, що хочете вийти?')) logout()
                  }}
                  className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-bold uppercase tracking-wider text-xs active:scale-95 transition-all"
                >
                  Вийти з системи
                </button>
                <button 
                  onClick={() => setShowProfile(false)}
                  className="w-full py-4 text-gray-500 text-xs font-mono uppercase tracking-widest"
                >
                  Закрити
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
