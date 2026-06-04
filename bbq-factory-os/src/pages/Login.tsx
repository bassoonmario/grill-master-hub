import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, Role } from '@/context/AuthContext'

type Screen = 'choice' | 'login-select' | 'login-pin' | 'reg-role' | 'reg-name' | 'reg-pin' | 'reg-confirm'

interface UserItem { tid: number; name: string; role: string }

const ROLES: { key: Role; label: string; icon: string }[] = [
  { key: 'master', label: 'Майстер', icon: '⚒' },
  { key: 'driver', label: 'Водій',   icon: '🚚' },
  { key: 'admin',  label: 'Шеф',     icon: '👑' },
]

export function Login() {
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
    fetch(`${import.meta.env.VITE_API_URL}/api/auth/users`)
      .then(r => r.json()).then(setUsers).catch(() => {})
  }, [])

  useEffect(() => {
    if (screen === 'login-pin' && loginPin.length === 4 && selUser) {
      setLoading(true); setError('')
      login(selUser.tid, loginPin)
        .then(() => navigate('/'))
        .catch(e => { setError(e.message); setLoginPin('') })
        .finally(() => setLoading(false))
    }
  }, [loginPin, screen, selUser])

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
    <div style={{
      minHeight:'100vh', background:'#080808',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:'24px', fontFamily:"'Rajdhani',sans-serif",
      position:'relative', overflow:'hidden'
    }}>
      <div style={{
        position:'absolute', bottom:'-150px', left:'50%', transform:'translateX(-50%)',
        width:'400px', height:'400px', borderRadius:'50%',
        background:'radial-gradient(ellipse, #c9963a10 0%, transparent 65%)',
        pointerEvents:'none'
      }}/>

      <div style={{ textAlign:'center', marginBottom:'40px' }}>
        <div style={{ fontSize:'44px', marginBottom:'12px' }}>🔥</div>
        <h1 style={{
          fontFamily:"'Cormorant Garamond',serif", fontSize:'32px', fontWeight:300,
          letterSpacing:'8px', color:'#e8e0d0', textTransform:'uppercase', lineHeight:1
        }}>BBQ FACTORY</h1>
        <p style={{
          fontFamily:"'JetBrains Mono',monospace", fontSize:'9px', color:'#c9963a',
          letterSpacing:'4px', marginTop:'6px', opacity:.7
        }}>PRODUCTION OS</p>
      </div>

      <div style={{ width:'100%', maxWidth:'320px' }}>
        {screen === 'choice' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <GoldBtn onClick={() => setScreen('login-select')}>УВІЙТИ</GoldBtn>
            <OutlineBtn onClick={() => setScreen('reg-role')}>РЕЄСТРАЦІЯ</OutlineBtn>
          </div>
        )}
        {screen === 'login-select' && (
          <>
            <SectionLabel>Оберіть акаунт</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
              {users.map(u => (
                <button key={u.tid}
                  onClick={() => { setSelUser(u); setLoginPin(''); setError(''); setScreen('login-pin') }}
                  style={{
                    background:'#111009', border:'1px solid #3a3530', color:'#e8e0d0',
                    padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px',
                    cursor:'pointer', fontFamily:"'Rajdhani',sans-serif",
                    fontSize:'16px', fontWeight:600, letterSpacing:'1px',
                    clipPath:'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)'
                  }}>
                  <span style={{ fontSize:'20px' }}>{u.role==='admin'?'👑':u.role==='driver'?'🚚':'⚒'}</span>
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
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
              {ROLES.map(r => (
                <button key={r.key}
                  onClick={() => { setRegRole(r.key); setScreen('reg-name') }}
                  style={{
                    background:'#111009', border:'1px solid #3a3530', color:'#e8e0d0',
                    padding:'16px', cursor:'pointer',
                    fontFamily:"'Rajdhani',sans-serif", fontSize:'17px', fontWeight:600,
                    letterSpacing:'2px', display:'flex', alignItems:'center', gap:'12px',
                  }}>
                  <span style={{fontSize:'22px'}}>{r.icon}</span> {r.label}
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
              style={{
                width:'100%', background:'#111009', border:'1px solid #3a3530',
                color:'#e8e0d0', fontFamily:"'Rajdhani',sans-serif",
                fontSize:'20px', fontWeight:500, padding:'14px 16px', outline:'none',
                marginBottom:'16px',
                clipPath:'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)'
              }}
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <GoldBtn onClick={() => {
              if (!regName.trim()) { setError("Введіть ім'я"); return }
              setError(''); setScreen('reg-pin')
            }}>ДАЛІ →</GoldBtn>
            <OutlineBtn onClick={() => setScreen('reg-role')}>← НАЗАД</OutlineBtn>
          </>
        )}
        {screen === 'reg-pin' && (
          <>
            <SectionLabel>Придумайте пін · {regName}</SectionLabel>
            <PinDisplay value={regPin} />
            <PinPad
              onDigit={d => { if (regPin.length < 4) setRegPin(p => p+d) }}
              onDel={() => setRegPin(p => p.slice(0,-1))}
              disabled={false}
            />
            {regPin.length === 4 && (
              <GoldBtn onClick={() => { setError(''); setRegConfirm(''); setScreen('reg-confirm') }}>ДАЛІ →</GoldBtn>
            )}
            <OutlineBtn onClick={() => { setRegPin(''); setScreen('reg-name') }}>← НАЗАД</OutlineBtn>
          </>
        )}
        {screen === 'reg-confirm' && (
          <>
            <SectionLabel>Підтвердіть пін · {regName}</SectionLabel>
            <PinDisplay value={regConfirm} />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <PinPad
              onDigit={d => { if (regConfirm.length < 4 && !loading) setRegConfirm(p => p+d) }}
              onDel={() => setRegConfirm(p => p.slice(0,-1))}
              disabled={loading}
            />
            <OutlineBtn onClick={() => { setRegConfirm(''); setError(''); setScreen('reg-pin') }}>← НАЗАД</OutlineBtn>
          </>
        )}
      </div>
    </div>
  )
}

function PinDisplay({ value }: { value: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'center', gap:'16px', margin:'20px 0' }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          width:'48px', height:'48px',
          border:`2px solid ${i < value.length ? '#c9963a' : '#3a3530'}`,
          background: i < value.length ? '#c9963a28' : 'transparent',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'24px', color:'#c9963a', transition:'all .15s',
          clipPath:'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,0 100%)'
        }}>
          {i < value.length ? '◆' : ''}
        </div>
      ))}
    </div>
  )
}

function PinPad({ onDigit, onDel, disabled }: {
  onDigit: (d: string) => void; onDel: () => void; disabled: boolean
}) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', margin:'0 0 16px' }}>
      {keys.map((k, i) => k === '' ? <div key={i}/> : (
        <button key={i}
          onClick={() => k==='⌫' ? onDel() : onDigit(k)}
          disabled={disabled}
          style={{
            background: k==='⌫' ? 'transparent' : '#111009',
            border:'1px solid #3a3530',
            color: k==='⌫' ? '#5a5248' : '#e8e0d0',
            fontFamily:"'Rajdhani',sans-serif",
            fontSize: k==='⌫' ? '20px' : '24px', fontWeight:600,
            padding:'16px', cursor:disabled?'wait':'pointer',
            transition:'background .1s',
          }}
        >{k}</button>
      ))}
    </div>
  )
}

function GoldBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width:'100%', background:'linear-gradient(135deg,#c9963a,#a07828)',
      border:'none', color:'#000', fontFamily:"'Rajdhani',sans-serif",
      fontSize:'18px', fontWeight:700, letterSpacing:'3px', textTransform:'uppercase',
      padding:'16px', cursor:'pointer', marginBottom:'8px',
      clipPath:'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))'
    }}>{children}</button>
  )
}

function OutlineBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width:'100%', background:'transparent', border:'1px solid #3a3530',
      color:'#5a5248', fontFamily:"'Rajdhani',sans-serif",
      fontSize:'14px', fontWeight:600, letterSpacing:'2px',
      textTransform:'uppercase', padding:'12px', cursor:'pointer', marginTop:'4px'
    }}>{children}</button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily:"'JetBrains Mono',monospace", fontSize:'9px', color:'#c9963a',
      letterSpacing:'3px', textTransform:'uppercase',
      marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px'
    }}>
      {children}
      <div style={{flex:1, height:'1px', background:'#3a3530'}}/>
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background:'#8b202028', border:'1px solid #8b2020', color:'#e08080',
      padding:'10px 14px', fontFamily:"'JetBrains Mono',monospace",
      fontSize:'11px', letterSpacing:'1px', marginBottom:'12px', textAlign:'center'
    }}>{children}</div>
  )
}
