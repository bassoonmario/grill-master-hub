import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Truck, AlertTriangle, Home, Package, Hammer, Banknote, BarChart3, Box, History, ShieldCheck, Users, Settings } from 'lucide-react'

interface NavItem {
  path: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  roles: string[]
  badge?: number
}

const COMMON_ITEMS: NavItem[] = [
  { path: '/',          icon: Home, label: 'Головна',  roles: ['driver'] },
  { path: '/warehouse', icon: Package, label: 'Склад',    roles: ['driver'], badge: 2 },
  { path: '/tasker',    icon: Truck,   label: 'Таскер',   roles: ['driver'], badge: 1 },
]

const MASTER_ITEMS: NavItem[] = [
  { path: '/master',               icon: BarChart3,     label: 'Дашборд', roles: ['master'] },
  { path: '/master?tab=stats',     icon: History,       label: 'Історія',roles: ['master'] },
  { path: '/master?tab=shipments', icon: Truck,         label: 'Відправки',roles: ['master'] },
  { path: '/master?tab=defects',   icon: AlertTriangle, label: 'Брак',    roles: ['master'] },
  { path: '/master?tab=balance',   icon: Box,           label: 'Баланс',  roles: ['master'] },
]

const ADMIN_ITEMS: NavItem[] = [
  { path: '/admin?tab=dashboard',  icon: BarChart3, label: 'Дашборд', roles: ['admin'] },
  { path: '/admin?tab=warehouses', icon: Package,   label: 'Склади',  roles: ['admin'] },
  { path: '/admin?tab=tasker',     icon: Truck,     label: 'Таскер',  roles: ['admin'] },
  { path: '/admin?tab=masters',    icon: Users,     label: 'Персонал',roles: ['admin'] },
  { path: '/admin?tab=system',     icon: Settings,  label: 'Система', roles: ['admin'] },
]

export function BottomNav() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  if (loading || !user) {
    return <div className="fixed bottom-0 left-0 right-0 h-[64px] bg-black border-t border-white/5 z-50 flex items-center justify-center">
      <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
    </div>
  }

  let items: NavItem[] = []
  if (user.role === 'admin') {
    items = ADMIN_ITEMS
  } else if (user.role === 'master') {
    items = MASTER_ITEMS
  } else {
    items = COMMON_ITEMS.filter(i => i.roles.includes(user.role))
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-white/5 z-50 flex shadow-[0_-4px_10px_rgba(0,0,0,0.3)]"
         style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      {items.map(item => {
        const fullPath = item.path
        let active = (pathname + search) === fullPath || (pathname === '/' && item.path === '/')
        
        // Handle default tabs logic
        if (pathname === '/admin' && !search && item.path === '/admin?tab=dashboard') active = true
        if (pathname === '/master' && !search && item.path === '/master') active = true
        
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1 relative border-none bg-transparent cursor-pointer transition-all duration-300 active:scale-95"
            style={{ color: active ? 'var(--orange)' : 'var(--text-dim)' }}
          >
            {item.badge && (
              <span className="absolute top-1 right-[calc(50%-18px)] bg-[var(--red)] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center font-mono">
                {item.badge}
              </span>
            )}
            <item.icon className="w-6 h-6" />
            <span className="text-[9px] font-mono tracking-wide uppercase font-bold whitespace-nowrap">{item.label}</span>
            {active && (
              <span className="absolute top-0 left-1/4 right-1/4 h-1 rounded-b-full bg-[var(--orange)] shadow-[0_2px_10px_rgba(255,140,66,0.5)]" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
