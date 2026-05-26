import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface NavItem {
  path: string
  icon: string
  label: string
  roles: string[]
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { path: '/',          icon: '🏠', label: 'Головна',  roles: ['admin','master','driver'] },
  { path: '/warehouse', icon: '📦', label: 'Склад',    roles: ['admin','master','driver'], badge: 2 },
  { path: '/tasks',     icon: '🔨', label: 'Завдання', roles: ['admin','master'] },
  { path: '/tasker',    icon: '🚚', label: 'Таскер',   roles: ['admin','driver'],          badge: 1 },
  { path: '/salary',    icon: '💰', label: 'Зарплата', roles: ['admin','master'] },
]

export function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  if (!user) return null

  const visible = NAV_ITEMS.filter(i => i.roles.includes(user.role))

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50 flex"
         style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      {visible.map(item => {
        const active = pathname === item.path
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1 relative border-none bg-transparent cursor-pointer transition-colors"
            style={{ color: active ? 'var(--orange)' : 'var(--text-dim)' }}
          >
            {item.badge && (
              <span className="absolute top-1 right-[calc(50%-18px)] bg-[var(--red)] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center font-mono">
                {item.badge}
              </span>
            )}
            <span className="text-[22px] leading-none">{item.icon}</span>
            <span className="text-[10px] font-mono tracking-wide">{item.label}</span>
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--orange)]" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
