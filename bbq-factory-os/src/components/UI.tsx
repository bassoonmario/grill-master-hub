import { ReactNode } from 'react'

// ─── STAT CARD ────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode // Адаптовано під JSX-компоненти lucide-react
  value: string | number
  label: string
  accent?: 'orange' | 'green' | 'yellow' | 'red'
  wide?: boolean
  children?: ReactNode
}

const ACCENT_COLORS = {
  orange: 'var(--orange)',
  green:  'var(--green)',
  yellow: 'var(--yellow)',
  red:    'var(--red)',
}

export function StatCard({ icon, value, label, accent = 'orange', wide, children }: StatCardProps) {
  const color = ACCENT_COLORS[accent]
  return (
    <div
      className={`bg-surface border border-border rounded-xl p-4 relative overflow-hidden ${wide ? 'col-span-2 flex items-center justify-between' : ''}`}
      style={{ '--accent': color } as React.CSSProperties}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color, opacity: 0.6 }} />
      <div>
        <span className="block mb-2 text-[var(--accent)]">{icon}</span>
        <div className="font-display text-4xl leading-none" style={{ color }}>{value}</div>
        <div className="text-xs text-[var(--text-dim)] mt-1 font-mono tracking-wide">{label}</div>
      </div>
      {children}
    </div>
  )
}

// ─── SECTION TITLE ────────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[11px] text-[var(--text-dim)] tracking-[3px] uppercase mb-3 mt-6 first:mt-0">
      {children}
    </div>
  )
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-xl overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

// ─── STATUS TAG ───────────────────────────────────────────────────────────────
type TagType = 'new' | 'progress' | 'done' | 'active' | 'pending'

const TAG_STYLES: Record<TagType, string> = {
  new:     'bg-[var(--orange-dim)] border border-[var(--orange-mid)] text-[var(--orange)]',
  active:  'bg-[var(--orange-dim)] border border-[var(--orange-mid)] text-[var(--orange)]',
  progress:'bg-[var(--yellow-dim)] border border-[var(--yellow)] text-[var(--yellow)]',
  done:    'bg-[var(--green-dim)]  border border-[var(--green)]  text-[var(--green)]',
  pending: 'bg-surface2 border border-border text-[var(--text-dim)]',
}

const TAG_LABELS: Record<TagType, string> = {
  new: 'НОВЕ', active: 'АКТИВНО', progress: 'В РОБОТІ', done: 'ВИКОНАНО', pending: 'ОЧІКУЄ'
}

export function StatusTag({ type }: { type: TagType }) {
  return (
    <span className={`font-mono text-[10px] px-2.5 py-1 rounded-full tracking-wider ${TAG_STYLES[type]}`}>
      {TAG_LABELS[type]}
    </span>
  )
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
export function ProgressBar({ pct, label, subleft, subright }: {
  pct: number; label: string; subleft?: string; subright?: string
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-display text-xl text-[var(--orange)]">{pct}%</span>
      </div>
      <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--orange), #ff8c42)' }}
        />
      </div>
      {(subleft || subright) && (
        <div className="flex justify-between mt-2">
          <span className="text-xs text-[var(--text-dim)] font-mono">{subleft}</span>
          <span className="text-xs text-[var(--text-dim)] font-mono">{subright}</span>
        </div>
      )}
    </div>
  )
}

// ─── LOADING SPINNER ──────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-border border-t-[var(--orange)] rounded-full animate-spin" />
    </div>
  )
}

// ─── ALERT BANNER ─────────────────────────────────────────────────────────────
export function AlertBanner({ text, level }: { text: string; level: 'warning' | 'critical' }) {
  const isC = level === 'critical'
  return (
    <div className={`flex items-center gap-3 rounded-xl p-3 mb-4 border ${
      isC ? 'bg-[var(--red-dim)] border-[var(--red)]' : 'bg-[var(--yellow-dim)] border-[var(--yellow)]'
    }`}>
      <span className="text-lg">{isC ? '🚨' : '⚠️'}</span>
      <span className={`text-sm flex-1 ${isC ? 'text-[var(--red)]' : 'text-[var(--yellow)]'}`}>{text}</span>
      <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${
        isC ? 'border-[var(--red)] text-[var(--red)]' : 'border-[var(--yellow)] text-[var(--yellow)]'
      }`}>{isC ? 'КРИТИЧНО' : 'УВАГА'}</span>
    </div>
  )
}
