import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useEffect } from 'react'

import { AdminDashboard } from './admin/AdminDashboard'
import { AdminWarehouses } from './admin/AdminWarehouses'
import { AdminTasker } from './admin/AdminTasker'
import { AdminMasters } from './admin/AdminMasters'
import { AdminSystem } from './admin/AdminSystem'

export function AdminCabinet() {
  const { user } = useAuth()
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
    <div className="px-1 pt-3 pb-4 w-full">
      {renderTab()}
    </div>
  )
}
