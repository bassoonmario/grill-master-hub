import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, Role } from '@/context/AuthContext'

type Screen = 'choice' | 'login-select' | 'login-pin' | 'reg-role' | 'reg-name' | 'reg-pin' | 'reg-confirm'

interface UserItem { tid: number; name: string; role: string }

const ROLES: { key: Role; label: string; icon: string }[] = [
  { key: 'master', label: 'Майстер',  icon: '⚒' },
  { key: 'driver', label: 'Водій',    icon: '🚚' },
  { key: 'admin',  label: 'Шеф',      icon: '👑' },
]

export function Login() {
  const [screen, setScreen]       = useState<Screen>('choice')
  const [users, setUsers]         = useState<UserItem[]>([])
  const [selUser, setSelUser]     = useState<UserItem | null>(null)
  const [regRole, setRegRole]     = useState<Role>('master')
  const [regName, setRegName]     = useState('')
  const [pin, setPin]             = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const { login, register }       = useAuth()
  const navigate                  = useNavigate()

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/auth/users`)
      .then(r => r.json())
      .then(setUsers)
      .catch(() => {})
  }, [])

  const resetPin = () => setPin('')
  const resetAll = () => { setPin(''); setPinConfirm(''); setError(''); setSelUser(null); setRegName('') }

  // Пін-пад
  const addDigit = (d: string, target: 'pin' | 'confirm') => {
    const setter = target === 'pin' ? setPin : setPinConfirm
    const val    = target === 'pin' ? pin    : pinConfirm
    if (val.length < 4) setter(val + d)
  }

  const delDigit = (target: 'pin' | 'confirm') => {
    const setter = target === 'pin' ? setPin : setPinConfirm
    const val    = target === 'pin' ? pin    : pinConfirm
    setter(val.slice(0, -1))
  }

  // Логін — після введення 4 цифр
  useEffect(() => {
    if (screen === 'login-pin' && pin.length === 4 && selUser) {
      setLoading(true); setError('')
      login(selUser.tid, pin)
        .then(() => navigate('/'))
        .catch(e => { setError(e.message); resetPin() })
        .finally(() => setLoading(false))
    }
  }, [pin, screen])

  // Реєстрація — підтвердження піну
  useEffect(() => {
    if (screen === 'reg-confirm' && pinConfirm.length === 4) {
      if (pin !== pinConfirm) {
        setError('Піни не співпадають')
        setPinConfirm('')
        return
      }
      setLoading(true); setError('')
      register(regName, regRole, pin)
        .then(() => navigate('/'))
        .catch(e => { setError(e.message); setPinConfirm('') })
        .finally(() => setLoading(false))
    }
  }, [pinConfirm, screen])

  return (
    <div style={{
      minHeight:'100vh', background:'#080808',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:'24px', fontFamily:"'Rajdhani',sans-serif",
      position:'relative', overflow:'hidden'
    }}>
      {/* Glow */}
      <div style={{
        position:'absolute', bottom:'-150px', left:'50%', transform:'translateX(-50%)',
        width:'400px', height:'400px', borderRadius:'50%',
        background:'radial-gradient(ellipse, #c9963a10 0%, transparent 65%)',
        pointerEvents:'none'
      }}/>

      {/* Logo */}
      <div style={{ textAlign:'center', marginBottom:'40px' }}>
        <div style={{ fontSize:'44px', marginBottom:'12px' }}>🔥</div>
        <h1 style={{
          fontFamily:"'Cormorant Garamond',serif",
          fontSize:'32px', fontWeight:300,
          letterSpacing:'8px', color:'#e8e0d0',
          textTransform:'uppercase', lineHeight:1
        }}>BBQ FACTORY</h1>
        <p style={{
          fontFamily:"'JetBrains Mono',monospace",
          fontSize:'9px', color:'#c9963a',
          letterSpacing:'4px', marginTop:'6px', opacity:.7
        }}>PRODUCTION OS</p>
      </div>

      <div style={{ width:'100%', maxWidth:'320px' }}>

        {/* ── CHOICE ── */}
        {screen === 'choice' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <GoldBtn onClick={() => setScreen('login-select')}>УВІЙТИ</GoldBtn>
            <OutlineBtn onClick={() => setScreen('reg-role')}>РЕЄСТРАЦІЯ</OutlineBtn>
          </div>
        )}

        {/* ── LOGIN: вибір імені ── */}
        {screen === 'login-select' && (
          <>
            <SectionLabel>Оберіть акаунт</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
              {users.map(u => (
                <button key={u.tid} onClick={() => { setSelUser(u); setScreen('login-pin') }}
                  style={{
                    background:'#111009', border:'1px solid #3a3530',
                    color:'#e8e0d0', padding:'14px 16px',
                    display:'flex', alignItems:'center', gap:'12px',
                    cursor:'pointer', fontFamily:"'Rajdhani',sans-serif",
                    fontSize:'16px', fontWeight:600, letterSpacing:'1px',
                    transition:'border-color .2s',
                    clipPath:'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)'
                  }}>
                  <span style={{ fontSize:'20px' }}>
                    {u.role==='admin'?'👑':u.role==='driver'?'🚚':'⚒'}
                  </span>
                  <span>{u.name}</span>
                  <span style={{ marginLeft:'auto', fontSize:'11px', color:'#5a5248', fontFamily:"'JetBrains Mono',monospace", letterSpacing:'1px' }}>
                    {u.role==='admin'?'ШЕФ':u.role==='driver'?'ВОДІЙ':'МАЙСТЕР'}
                  </span>
                </button>
              ))}
            </div>
            <OutlineBtn onClick={() => { resetAll(); setScreen('choice') }}>← НАЗАД</OutlineBtn>
          </>
        )}

        {/* ── LOGIN: пін ── */}
        {screen === 'login-pin' && selUser && (
          <>
            <SectionLabel>Пін-код для {selUser.name}</SectionLabel>
            <PinDisplay value={pin} />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <PinPad onDigit={d => addDigit(d,'pin')} onDel={() => delDigit('pin')} disabled={loading} />
            <OutlineBtn onClick={() => { resetPin(); setScreen('login-select') }}>← НАЗАД</OutlineBtn>
          </>
        )}

        {/* ── REG: роль ── */}
        {screen === 'reg-role' && (
          <>
            <SectionLabel>Оберіть роль</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
              {ROLES.map(r => (
                <button key={r.key}
                  onClick={() => { setRegRole(r.key); setScreen('reg-name') }}
                  style={{
                    background: regRole===r.key ? '#c9963a28' : '#111009',
                    border: `1px solid ${regRole===r.key ? '#c9963a66' : '#3a3530'}`,
                    color: regRole===r.key ? '#c9963a' : '#e8e0d0',
                    padding:'16px', cursor:'pointer',
                    fontFamily:"'Rajdhani',sans-serif",
                    fontSize:'17px', fontWeight:600, letterSpacing:'2px',
                    display:'flex', alignItems:'center', gap:'12px',
                  }}>
                  <span style={{fontSize:'22px'}}>{r.icon}</span> {r.label}
                </button>
              ))}
            </div>
            <OutlineBtn onClick={() => { resetAll(); setScreen('choice') }}>← НАЗАД</OutlineBtn>
          </>
        )}

        {/* ── REG: ім'я ── */}
        {screen === 'reg-name' && (
          <>
            <SectionLabel>Ваше ім'я</SectionLabel>
            <input
              value={regName}
              onChange={e => setRegName(e.target.value)}
              placeholder="Введіть ім'я"
              autoFocus
              style={{
                width:'100%', background:'#111009',
                border:'1px solid #3a3530', color:'#e8e0d0',
                fontFamily:"'Rajdhani',sans-serif",
                fontSize:'20px', fontWeight:500,
                padding:'14px 16px', outline:'none',
                marginBottom:'16px',
                clipPath:'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)'
              }}
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <GoldBtn onClick={() => {
              if (!regName.trim()) { setError("Введіть ім'я"); return }
              setError(''); setScreen('reg-pin')
            }}>ДАЛІ →</GoldBtn>
            <div style={{marginTop:'8px'}}>
              <OutlineBtn onClick={() => setScreen('reg-role')}>← НАЗАД</OutlineBtn>
            </div>
          </>
        )}

        {/* ── REG: придумай пін ── */}
        {screen === 'reg-pin' && (
          <>
            <SectionLabel>Придумайте пін-код</SectionLabel>
            <PinDisplay value={pin} />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <PinPad onDigit={d => addDigit(d,'pin')} onDel={() => delDigit('pin')} disabled={false} />
            {pin.length === 4 && (
              <GoldBtn onClick={() => { setError(''); setScreen('reg-confirm') }}>ДАЛІ →</GoldBtn>
            )}
            <div style={{marginTop:'8px'}}>
              <OutlineBtn onClick={() => { resetPin(); setScreen('reg-name') }}>← НАЗАД</OutlineBtn>
            </div>
          </>
        )}

        {/* ── REG: підтверди пін ── */}
        {screen === 'reg-confirm' && (
          <>
            <SectionLabel>Підтвердіть пін-код</SectionLabel>
            <PinDisplay value={pinConfirm} />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <PinPad onDigit={d => addDigit(d,'confirm')} onDel={() => delDigit('confirm')} disabled={loading} />
            <div style={{marginTop:'8px'}}>
              <OutlineBtn onClick={() => { setPinConfirm(''); setScreen('reg-pin') }}>← НАЗАД</OutlineBtn>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// ── COMPONENTS ────────────────────────────────────────────────────────────────

function PinDisplay({ value }: { value: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'center', gap:'16px', margin:'20px 0' }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          width:'48px', height:'48px',
          border:`2px solid ${i < value.length ? '#c9963a' : '#3a3530'}`,
          background: i < value.length ? '#c9963a28' : 'transparent',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'24px', color:'#c9963a',
          transition:'all .15s',
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
    <div style={{
      display:'grid', gridTemplateColumns:'repeat(3,1fr)',
      gap:'8px', margin:'0 0 16px'
    }}>
      {keys.map((k, i) => k === '' ? <div key={i}/> : (
        <button key={i}
          onClick={() => k === '⌫' ? onDel() : onDigit(k)}
          disabled={disabled}
          style={{
            background: k==='⌫' ? 'transparent' : '#111009',
            border:`1px solid ${k==='⌫' ? '#3a3530' : '#3a3530'}`,
            color: k==='⌫' ? '#5a5248' : '#e8e0d0',
            fontFamily:"'Rajdhani',sans-serif",
            fontSize: k==='⌫' ? '20px' : '24px',
            fontWeight:600,
            padding:'16px', cursor:disabled?'wait':'pointer',
            transition:'all .15s',
            opacity: disabled ? .5 : 1,
          }}
          onMouseDown={e => (e.currentTarget.style.background='#c9963a22')}
          onMouseUp={e => (e.currentTarget.style.background=k==='⌫'?'transparent':'#111009')}
          onTouchStart={e => (e.currentTarget.style.background='#c9963a22')}
          onTouchEnd={e => (e.currentTarget.style.background=k==='⌫'?'transparent':'#111009')}
        >
          {k}
        </button>
      ))}
    </div>
  )
}

function GoldBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width:'100%',
      background:'linear-gradient(135deg,#c9963a,#a07828)',
      border:'none', color:'#000',
      fontFamily:"'Rajdhani',sans-serif",
      fontSize:'18px', fontWeight:700,
      letterSpacing:'3px', textTransform:'uppercase',
      padding:'16px', cursor:'pointer',
      clipPath:'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))',
      marginBottom:'8px'
    }}>{children}</button>
  )
}

function OutlineBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width:'100%', background:'transparent',
      border:'1px solid #3a3530', color:'#5a5248',
      fontFamily:"'Rajdhani',sans-serif",
      fontSize:'14px', fontWeight:600,
      letterSpacing:'2px', textTransform:'uppercase',
      padding:'12px', cursor:'pointer', marginTop:'4px'
    }}>{children}</button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily:"'JetBrains Mono',monospace",
      fontSize:'9px', color:'#c9963a',
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
      background:'#8b202028', border:'1px solid #8b2020',
      color:'#e08080', padding:'10px 14px',
      fontFamily:"'JetBrains Mono',monospace",
      fontSize:'11px', letterSpacing:'1px',
      marginBottom:'12px', textAlign:'center'
    }}>{children}</div>
  )
}
