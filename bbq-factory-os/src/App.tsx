import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { Login }     from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Warehouse } from '@/pages/Warehouse'
import { Tasks }     from '@/pages/Tasks'
import { Tasker }    from '@/pages/Tasker'
import { Salary }    from '@/pages/Salary'
import '@/index.css'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/"          element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/warehouse" element={<PrivateRoute><Warehouse /></PrivateRoute>} />
      <Route path="/tasks"     element={<PrivateRoute><Tasks /></PrivateRoute>} />
      <Route path="/tasker"    element={<PrivateRoute><Tasker /></PrivateRoute>} />
      <Route path="/salary"    element={<PrivateRoute><Salary /></PrivateRoute>} />
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
