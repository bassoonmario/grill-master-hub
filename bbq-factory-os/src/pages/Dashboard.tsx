import { useEffect, useState } from 'react'
import { api, DashboardData, Shipment, Defect } from '@/lib/api'
import { StatCard, SectionTitle, ProgressBar, AlertBanner, Spinner } from '@/components/UI'

type Tab = 'main' | 'shipments' | 'defects'

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('main')
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [defects, setDefects] = useState<Defect[]>([])

  useEffect(() => { 
    api.dashboard().then(setData) 
  }, [])

  useEffect(() => {
    if (activeTab === 'shipments') api.getShipments().then(setShipments)
    if (activeTab === 'defects') api.getDefects().then(setDefects)
  }, [activeTab])

  if (!data) return <Spinner />

  const pct = Math.round((data.plan_done / data.plan_total) * 100)

  return (
    <div style={{ fontFamily: 'Rajdhani, sans-serif' }}>
      {/* Вкладки перемикання меню */}
      <div className="flex bg-surface border-b border-border mb-4">
        {(['main', 'shipments', 'defects'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors font-display ${
              activeTab === tab 
                ? 'text-[var(--orange)] border-b-2 border-[var(--orange)]' 
                : 'text-[var(--text-dim)] hover:text-[var(--orange)]'
            }`}
          >
            {tab === 'main' ? 'Головна' : tab === 'shipments' ? 'Відправки' : 'Брак'}
          </button>
        ))}
      </div>

      {/* ГІЛКА "ГОЛОВНА" — ПОВНІСТЮ ОРИГІНАЛЬНИЙ КОД ДАШБОРДУ */}
      {activeTab === 'main' && (
        <>
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
        </>
      )}

      {/* ГІЛКА "ВІДПРАВКИ" */}
      {activeTab === 'shipments' && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <SectionTitle>Списки відправок</SectionTitle>
          <div className="flex flex-col gap-2 mt-2">
            {shipments.length === 0 ? (
              <div className="text-sm text-[var(--text-dim)] italic py-2">Списки відправок порожні</div>
            ) : (
              shipments.map(s => (
                <div key={s.id} className="py-2.5 border-b border-border last:border-0 text-[var(--text-dim)] text-sm">
                  <div className="flex justify-between font-medium text-[var(--text)]">
                    <span>📅 {new Date(s.shipment_date).toLocaleDateString('uk-UA')} | Артикул: <span className="text-[var(--orange)]">{s.article}</span></span>
                    <span className="font-display text-lg text-[var(--green)]">{s.quantity} шт</span>
                  </div>
                  <div className="text-[11px] font-mono mt-1 flex gap-2">
                    <span>{s.is_engraved ? '🎨 З гравіруванням' : '🔲 Без гравірування'}</span>
                  </div>
                  {s.raw_comment && <div className="text-[11px] italic mt-0.5 text-[var(--text-dim)]">💬 {s.raw_comment}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ГІЛКА "БРАК" */}
      {activeTab === 'defects' && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <SectionTitle>Облік внутрішнього браку</SectionTitle>
          <div className="flex flex-col gap-2 mt-2">
            {defects.length === 0 ? (
              <div className="text-sm text-[var(--text-dim)] italic py-2">Записів про брак не виявлено</div>
            ) : (
              defects.map(d => (
                <div key={d.id} className="py-2.5 border-b border-border last:border-0 text-[var(--text-dim)] text-sm">
                  <div className="flex justify-between font-medium text-[var(--text)]">
                    <span>📅 {new Date(d.defect_date).toLocaleDateString('uk-UA')} | СКУ: <span className="text-[var(--orange)]">{d.sku}</span></span>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-mono ${
                      d.status === 'fixed' ? 'bg-emerald-950 text-[var(--green)]' : 'bg-rose-950 text-red-400'
                    }`}>{d.status}</span>
                  </div>
                  <div className="text-[11px] font-mono mt-1">Тип виробу: {d.item_type}</div>
                  <div className="text-[11px] mt-0.5 text-[var(--text-dim)]">⚠️ Причина: {d.reason}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
function TaskDot({ status }: { status: 'done' | 'active' | 'pending' }) {
  const base = "w-2.5 h-2.5 rounded-full flex-shrink-0"
  if (status === 'done')    return <div className={`${base} bg-[var(--green)]`} />
  if (status === 'active')  return <div className={`${base} bg-[var(--orange)] animate-blink`} />
  return <div className={`${base} bg-border`} />
}