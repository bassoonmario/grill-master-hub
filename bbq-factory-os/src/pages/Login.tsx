import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, Role } from '@/context/AuthContext'
import { Card } from '@/components/UI'

type Screen = 'choice' | 'login-select' | 'login-pin' | 'reg-role' | 'reg-name' | 'reg-pin' | 'reg-confirm'

interface UserItem { tid: number; name: string; role: string }

const ROLES: { key: Role; label: string; icon: string }[] = [
  { key: 'master', label: 'Майстер', icon: '⚒' },
  { key: 'driver', label: 'Водій',   icon: '🚚' },
  { key: 'admin',  label: 'Шеф',     icon: '👑' },
]

export function Login() {
  const API_BASE = import.meta.env.VITE_API_URL ?? 
    (typeof window !== 'undefined' && window.location.hostname === 'test.wowusik.duckdns.org'
      ? `${window.location.protocol}//api-test.wowusik.duckdns.org`
      : '');

  const [screen, setScreen]         = useState<Screen>('choice')
  const [users, setUsers]           = useState<UserItem[]>([])
  const [selUser, setSelUser]       = useState<UserItem | null>(null)
  const [regRole, setRegRole]       = useState<Role>('master')
  const [regName, setRegName]       = useState('')
  const [regPin, setRegPin]         = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [loginPin, setLoginPin]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const { login, register }         = useAuth()
  const navigate                    = useNavigate()

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/users`)
      .then(r => r.json()).then(setUsers).catch(() => {})
  }, [API_BASE])

  useEffect(() => {
    if (screen === 'login-pin' && loginPin.length === 4 && selUser) {
      setLoading(true); setError('')
      login(selUser.tid, loginPin)
        .then(() => navigate('/'))
        .catch(e => { setError(e.message); setLoginPin('') })
        .finally(() => setLoading(false))
    }
  }, [loginPin, screen, selUser, login, navigate])

  const handleRegister = async () => {
    if (regPin !== regConfirm) {
      setError('Піни не співпадають'); setRegConfirm(''); return
    }
    if (!regName.trim()) { setError("Введіть ім'я"); return }
    if (regPin.length !== 4) { setError('Пін має бути 4 цифри'); return }

    setLoading(true); setError('')
    try {
      await register(regName.trim(), regRole, regPin)
      navigate('/')
    } catch (e: any) {
      setError(e.message)
      setRegConfirm('')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (screen === 'reg-confirm' && regConfirm.length === 4) {
      handleRegister()
    }
  }, [regConfirm, screen])

  const resetAll = () => {
    setLoginPin(''); setRegPin(''); setRegConfirm('')
    setError(''); setSelUser(null); setRegName(''); setRegRole('master')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-end pb-16 p-6 bg-[url('/assets/grills_factory_splash.png')] bg-cover bg-center bg-no-repeat">
      <div className="w-full max-w-[320px] bg-white/[0.03] backdrop-blur-sm border border-white/5 p-6 rounded-3xl">
        {screen === 'choice' && (
          <div className="flex flex-col gap-3">
            <GoldBtn onClick={() => setScreen('login-select')}>УВІЙТИ</GoldBtn>
            <OutlineBtn onClick={() => setScreen('reg-role')}>РЕЄСТРАЦІЯ</OutlineBtn>
          </div>
        )}
        {screen === 'login-select' && (
          <>
            <SectionLabel>Оберіть акаунт</SectionLabel>
            <div className="flex flex-col gap-2 mb-4">
              {users.map(u => (
                <button key={u.tid}
                  onClick={() => { setSelUser(u); setLoginPin(''); setError(''); setScreen('login-pin') }}
                  className="bg-white/5 border border-white/10 text-[#e8e0d0] p-4 flex items-center gap-3 hover:bg-white/10 transition-all text-left font-['Rajdhani'] text-base font-semibold tracking-wide">
                  <span className="text-xl">{u.role==='admin'?'👑':u.role==='driver'?'🚚':'⚒'}</span>
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
            <OutlineBtn onClick={() => { resetAll(); setScreen('choice') }}>← НАЗАД</OutlineBtn>
          </>
        )}
        {screen === 'login-pin' && selUser && (
          <>
            <SectionLabel>Пін-код · {selUser.name}</SectionLabel>
            <PinDisplay value={loginPin} />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <PinPad onDigit={d => { if (loginPin.length < 4 && !loading) setLoginPin(p => p+d) }} onDel={() => setLoginPin(p => p.slice(0,-1))} disabled={loading} />
            <OutlineBtn onClick={() => { resetAll(); setScreen('login-select') }}>← НАЗАД</OutlineBtn>
          </>
        )}
        {screen === 'reg-role' && (
          <>
            <SectionLabel>Оберіть роль</SectionLabel>
            <div className="flex flex-col gap-2 mb-4">
              {ROLES.map(r => (
                <button key={r.key}
                  onClick={() => { setRegRole(r.key); setScreen('reg-name') }}
                  className="bg-white/5 border border-white/10 text-[#e8e0d0] p-4 flex items-center gap-3 hover:bg-white/10 transition-all text-left font-['Rajdhani'] text-lg font-semibold tracking-wide">
                  <span className="text-2xl">{r.icon}</span> {r.label}
                </button>
              ))}
            </div>
            <OutlineBtn onClick={() => { resetAll(); setScreen('choice') }}>← НАЗАД</OutlineBtn>
          </>
        )}
        {screen === 'reg-name' && (
          <>
            <SectionLabel>Ваше ім'я · {ROLES.find(r=>r.key===regRole)?.label}</SectionLabel>
            <input
              value={regName}
              onChange={e => setRegName(e.target.value)}
              placeholder="Введіть ім'я"
              autoFocus
              className="w-full bg-white/5 border border-white/10 text-[#e8e0d0] font-['Rajdhani'] text-xl font-medium p-4 mb-4 outline-none focus:border-[#c9963a]"
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <GoldBtn onClick={() => { if (!regName.trim()) { setError("Введіть ім'я"); return }; setError(''); setScreen('reg-pin') }}>ДАЛІ →</GoldBtn>
            <OutlineBtn onClick={() => setScreen('reg-role')}>← НАЗАД</OutlineBtn>
          </>
        )}
        {screen === 'reg-pin' && (
          <>
            <SectionLabel>Придумайте пін · {regName}</SectionLabel>
            <PinDisplay value={regPin} />
            <PinPad onDigit={d => { if (regPin.length < 4) setRegPin(p => p+d) }} onDel={() => setRegPin(p => p.slice(0,-1))} disabled={false} />
            {regPin.length === 4 && <GoldBtn onClick={() => { setError(''); setRegConfirm(''); setScreen('reg-confirm') }}>ДАЛІ →</GoldBtn>}
            <OutlineBtn onClick={() => { setRegPin(''); setScreen('reg-name') }}>← НАЗАД</OutlineBtn>
          </>
        )}
        {screen === 'reg-confirm' && (
          <>
            <SectionLabel>Підтвердіть пін · {regName}</SectionLabel>
            <PinDisplay value={regConfirm} />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <PinPad onDigit={d => { if (regConfirm.length < 4 && !loading) setRegConfirm(p => p+d) }} onDel={() => setRegConfirm(p => p.slice(0,-1))} disabled={loading} />
            <OutlineBtn onClick={() => { setRegConfirm(''); setError(''); setScreen('reg-pin') }}>← НАЗАД</OutlineBtn>
          </>
        )}
      </div>
    </div>
  )
}

function PinDisplay({ value }: { value: string }) {
  return (
    <div className="flex justify-center gap-4 my-5">
      {[0,1,2,3].map(i => (
        <div key={i} className={`w-12 h-12 border-2 flex items-center justify-center text-2xl transition-all ${i < value.length ? 'border-[#c9963a] bg-[#c9963a28] text-[#c9963a]' : 'border-[#3a3530] text-transparent'}`}>
          {i < value.length ? '◆' : ''}
        </div>
      ))}
    </div>
  )
}

function PinPad({ onDigit, onDel, disabled }: { onDigit: (d: string) => void; onDel: () => void; disabled: boolean }) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']
  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {keys.map((k, i) => k === '' ? <div key={i}/> : (
        <button key={i} onClick={() => k==='⌫' ? onDel() : onDigit(k)} disabled={disabled} className="bg-white/5 border border-white/10 p-4 text-[#e8e0d0] font-['Rajdhani'] text-2xl font-semibold active:bg-white/10">
          {k}
        </button>
      ))}
    </div>
  )
}

function GoldBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full bg-gradient-to-br from-[#c9963a] to-[#a07828] text-black font-['Rajdhani'] text-lg font-bold tracking-[0.2em] uppercase p-4 mb-2">
      {children}
    </button>
  )
}

function OutlineBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full bg-transparent border border-white/10 text-[#5a5248] font-['Rajdhani'] text-sm font-semibold tracking-[0.2em] uppercase p-3 mt-1">
      {children}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-['JetBrains_Mono'] text-[9px] text-[#c9963a] tracking-[0.3em] uppercase mb-4 flex items-center gap-2">
      {children}
      <div className="flex-1 h-[1px] bg-white/10"/>
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-red-900/20 border border-red-900/50 text-[#e08080] p-3 font-['JetBrains_Mono'] text-[11px] tracking-wider mb-3 text-center">
      {children}
    </div>
  )
}
