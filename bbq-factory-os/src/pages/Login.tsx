import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, Role } from '@/context/AuthContext'

export function Login() {
  const [email, setEmail]       = useState('admin@bbq.ua')
  const [password, setPassword] = useState('demo1234')
  const [role, setRole]         = useState<Role>('admin')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const { login } = useAuth()
  const navigate  = useNavigate()

  const handleLogin = async () => {
    if (!email || !password) { setError('Заповніть всі поля'); return }
    setLoading(true); setError('')
    try {
      await login(email, password, role)
      navigate('/')
    } catch {
      setError('Невірні дані для входу')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6 relative overflow-hidden">
      {/* Glow */}
      <div className="absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, #ff5c1a18 0%, transparent 70%)',
                    animation: 'pulse-glow 4s ease-in-out infinite' }} />

      <div className="w-full max-w-sm relative z-10 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <span className="text-5xl block mb-2 animate-flicker">🔥</span>
          <h1 className="font-display text-4xl tracking-[6px] text-[var(--orange)] leading-none">
            BBQ FACTORY OS
          </h1>
          <p className="font-mono text-[11px] text-[var(--text-dim)] tracking-[3px] uppercase mt-2">
            Система управління виробництвом
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="master@bbq.ua"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </Field>

          <Field label="Пароль">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </Field>

          <Field label="Роль (demo)">
            <select value={role} onChange={e => setRole(e.target.value as Role)}>
              <option value="admin">👑 Адміністратор</option>
              <option value="master">🔨 Майстер</option>
              <option value="driver">🚚 Водій / Комірник</option>
            </select>
          </Field>

          {error && (
            <p className="text-[var(--red)] text-sm font-mono text-center">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full font-display text-xl tracking-[3px] py-4 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'var(--orange)', color: '#000', border: 'none', cursor: loading ? 'wait' : 'pointer' }}
          >
            {loading ? '...' : 'УВІЙТИ'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[11px] text-[var(--text-dim)] tracking-[2px] uppercase mb-2">
        {label}
      </label>
      <div className="[&>input]:w-full [&>input]:bg-surface [&>input]:border [&>input]:border-border [&>input]:rounded-lg [&>input]:text-[var(--text)] [&>input]:text-base [&>input]:px-4 [&>input]:py-3.5 [&>input]:outline-none [&>input]:transition-all [&>input:focus]:border-[var(--orange)] [&>select]:w-full [&>select]:bg-surface [&>select]:border [&>select]:border-border [&>select]:rounded-lg [&>select]:text-[var(--text)] [&>select]:text-base [&>select]:px-4 [&>select]:py-3.5 [&>select]:outline-none [&>select]:transition-all [&>select:focus]:border-[var(--orange)]">
        {children}
      </div>
    </div>
  )
}
