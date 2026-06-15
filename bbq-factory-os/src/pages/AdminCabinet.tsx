import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useEffect } from 'react'

import { AdminDashboard } from './admin/AdminDashboard'
import { AdminWarehouses } from './admin/AdminWarehouses'
import { AdminTasker } from './admin/AdminTasker'
import { AdminMasters } from './admin/AdminMasters'
import { AdminSystem } from './admin/AdminSystem'
import { ShieldCheck, LogOut } from 'lucide-react'

export function AdminCabinet() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'dashboard'

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login', { replace: true })
    }
  }, [user, navigate])

  if (!user || user.role !== 'admin') return null

  const renderTab = () => {
    switch (tab) {
      case 'dashboard': return <AdminDashboard />
      case 'warehouses': return <AdminWarehouses />
      case 'tasker': return <AdminTasker />
      case 'masters': return <AdminMasters />
      case 'system': return <AdminSystem />
      default: return <AdminDashboard />
    }
  }

  return (
    <div className="min-h-screen w-full" style={{
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-wood.png")'
    }}>
      <div className="p-4 pt-6 pb-24 w-full">
        <div className="flex justify-between items-end mb-6">
          <div className="mb-4">
            <h1 className="font-display text-xl md:text-2xl text-[#c9963a] uppercase tracking-wider mb-2 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" /> 
              ADMIN PANEL
            </h1>
            <p className="text-[var(--text-dim)] font-mono text-[10px] tracking-widest uppercase mt-1">
              суперкористувач • {user?.name}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-3 bg-white/5 border border-white/10 text-[var(--red)] rounded-xl active:scale-95 transition-all mb-4"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {renderTab()}
      </div>
    </div>
  )
}
