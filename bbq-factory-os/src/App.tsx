import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { Login }     from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Warehouse } from '@/pages/Warehouse'
import { Tasks }     from '@/pages/Tasks'
import { Tasker }    from '@/pages/Tasker'
import { Salary }    from '@/pages/Salary'
import { MasterCabinet } from '@/pages/MasterCabinet'
import { AdminCabinet } from '@/pages/AdminCabinet'
import { OfficeCabinet } from '@/pages/office/OfficeCabinet'
import { Balance }       from '@/pages/Balance'
import { Spinner } from '@/components/UI'
import '@/index.css'

function PrivateRoute({ children, requireRole }: { children: React.ReactNode, requireRole?: string }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (requireRole && user.role !== requireRole) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />
    if (user.role === 'master') return <Navigate to="/master" replace />
    if (user.role === 'office') return <Navigate to="/office" replace />
    return <Navigate to="/" replace />
  }
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0a]">
      <Spinner />
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      
      <Route path="/" element={
  user?.role === 'master'
    ? <Navigate to="/master" replace />
    : user?.role === 'admin'
    ? <Navigate to="/admin" replace />
    : user?.role === 'driver'
    ? <Navigate to="/tasker" replace />
    : user?.role === 'office'
    ? <Navigate to="/office" replace />
    : <PrivateRoute><Dashboard /></PrivateRoute>
} />

      <Route path="/admin"     element={<PrivateRoute requireRole="admin"><AdminCabinet /></PrivateRoute>} />
      <Route path="/office"    element={<PrivateRoute requireRole="office"><OfficeCabinet /></PrivateRoute>} />

      <Route path="/warehouse" element={<PrivateRoute><Warehouse /></PrivateRoute>} />
      <Route path="/tasks"     element={<PrivateRoute><Tasks /></PrivateRoute>} />
      <Route path="/tasker"    element={<PrivateRoute><Tasker /></PrivateRoute>} />
      <Route path="/salary"    element={<PrivateRoute><Salary /></PrivateRoute>} />
      <Route path="/master"    element={<PrivateRoute><MasterCabinet /></PrivateRoute>} />
      <Route path="/balance"   element={<PrivateRoute><Balance /></PrivateRoute>} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
