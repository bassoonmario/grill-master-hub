import { useEffect, useState } from 'react'
import { api, SalaryData } from '@/lib/api'
import { SectionTitle, ProgressBar, Spinner } from '@/components/UI'
import { useAuth } from '@/context/AuthContext'

export function Salary() {
  const [data, setData] = useState<SalaryData | null>(null)
  const { user } = useAuth()

  useEffect(() => { api.salary().then(setData) }, [])

  if (!data) return <Spinner />

  const rows = [
    { label: 'Базова ставка',    value: data.base,       sign: '',  color: 'var(--text)' },
    { label: 'Відрядна оплата',  value: data.piecework,  sign: '+', color: 'var(--green)' },
    { label: 'Премія за план',   value: data.bonus,      sign: '+', color: 'var(--green)' },
    { label: 'Штраф (брак)',     value: data.penalty,    sign: '−', color: 'var(--red)' },
  ]

  return (
    <div>
      <SectionTitle>Зарплата — Цикл {user?.cycleId}</SectionTitle>

      {/* Hero card */}
      <div className="rounded-xl p-6 text-center mb-4 border border-[var(--orange-mid)] relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg, var(--surface) 0%, #1a1008 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-0.5"
             style={{ background: 'linear-gradient(90deg, transparent, var(--orange), transparent)' }} />

        <div className="font-mono text-[11px] text-[var(--text-dim)] tracking-[2px] uppercase mb-2">
          Поточний заробіток
        </div>
        <div className="font-display text-6xl text-[var(--orange)] leading-none">
          {data.total.toLocaleString('uk-UA')}
        </div>
        <div className="font-mono text-[11px] text-[var(--text-dim)] tracking-wider mt-1 uppercase">
          гривень
        </div>

        {/* 3 stats */}
        <div className="flex justify-center gap-4 mt-5 pt-5 border-t border-border">
          <MiniStat value={`+${data.bonus.toLocaleString('uk-UA')}`} label="Премія" color="var(--green)" />
          <div className="w-px bg-border" />
          <MiniStat value={`${data.plan_pct}%`} label="План" color="var(--text-mid)" />
          <div className="w-px bg-border" />
          <MiniStat value={String(data.days_left)} label="Днів" color="var(--yellow)" />
        </div>
      </div>

      {/* Progress */}
      <ProgressBar
        pct={data.plan_pct}
        label="Виконання плану циклу"
        subleft={`${data.days_left} днів залишилось`}
        subright={`Цикл #${data.cycle_id}`}
      />

      {/* Breakdown */}
      <SectionTitle>Деталізація</SectionTitle>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {rows.map((row, i) => (
          <div key={i}
               className="flex justify-between items-center px-4 py-3.5"
               style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span className="text-[13px] text-[var(--text-mid)]">{row.label}</span>
            <span className="font-mono text-sm font-medium" style={{ color: row.color }}>
              {row.sign}{row.value.toLocaleString('uk-UA')} грн
            </span>
          </div>
        ))}
        {/* Total row */}
        <div className="flex justify-between items-center px-4 py-4 bg-surface2">
          <span className="text-sm font-semibold">Разом</span>
          <span className="font-mono text-base font-semibold text-[var(--orange)]">
            {data.total.toLocaleString('uk-UA')} грн
          </span>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-xl leading-none" style={{ color }}>{value}</div>
      <div className="font-mono text-[10px] text-[var(--text-dim)] mt-0.5 uppercase tracking-wider">{label}</div>
    </div>
  )
}
