import { useEffect, useState } from 'react'
import { api, DashboardData } from '@/lib/api'
import { StatCard, SectionTitle, ProgressBar, AlertBanner, Spinner } from '@/components/UI'

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => { api.dashboard().then(setData) }, [])

  if (!data) return <Spinner />

  const pct = Math.round((data.plan_done / data.plan_total) * 100)

  return (
    <div>
      {/* Alerts */}
      {data.alerts.map((a, i) => <AlertBanner key={i} text={a.text} level={a.level} />)}

      {/* Cycle progress */}
      <SectionTitle>Поточний цикл #{data.cycle_id}</SectionTitle>
      <ProgressBar
        pct={pct}
        label="Виконання плану"
        subleft={`${data.plan_done} / ${data.plan_total} виробів`}
        subright={`${data.days_left} днів залишилось`}
      />

      {/* Stats */}
      <SectionTitle>Показники</SectionTitle>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <StatCard icon="🏭" value={data.done_today}  label="Готово сьогодні" accent="orange" />
        <StatCard icon="✅" value={data.shipped}     label="Відвантажено"   accent="green"  />
        <StatCard icon="⏳" value={data.in_progress} label="В роботі"       accent="yellow" />
        <StatCard icon="❌" value={data.defects}     label="Брак"           accent="red"    />

        {/* Wide salary card */}
        <div className="col-span-2 bg-surface border border-border rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--orange)] opacity-60" />
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl block mb-2">💰</span>
              <div className="font-display text-4xl text-[var(--orange)] leading-none">
                {data.salary_base.toLocaleString('uk-UA')}
              </div>
              <div className="font-mono text-[11px] text-[var(--text-dim)] tracking-wide mt-1">
                Заробіток за цикл, грн
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[11px] text-[var(--text-dim)] mb-1">базова</div>
              <div className="font-display text-2xl text-[var(--green)]">+{data.salary_bonus.toLocaleString('uk-UA')}</div>
              <div className="text-[11px] text-[var(--text-dim)]">премія</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <SectionTitle>Завдання на сьогодні</SectionTitle>
      <div className="flex flex-col gap-2.5">
        {data.tasks.map(task => (
          <div key={task.id}
               className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3.5 active:bg-surface2 transition-colors cursor-pointer">
            <TaskDot status={task.status} />
            <div className="flex-1">
              <div className="text-sm font-medium">{task.name}</div>
              <div className="font-mono text-[11px] text-[var(--text-dim)] mt-0.5">
                {task.stage} → {task.status === 'done' ? 'готово' : task.status === 'active' ? 'в роботі' : 'очікує'}
              </div>
            </div>
            <div className="font-display text-xl"
                 style={{ color: task.status === 'done' ? 'var(--green)' : task.status === 'active' ? 'var(--orange)' : 'var(--text-dim)' }}>
              {task.fact}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskDot({ status }: { status: 'done' | 'active' | 'pending' }) {
  const base = "w-2.5 h-2.5 rounded-full flex-shrink-0"
  if (status === 'done')    return <div className={`${base} bg-[var(--green)]`} />
  if (status === 'active')  return <div className={`${base} bg-[var(--orange)] animate-blink`} />
  return <div className={`${base} bg-border`} />
}
