import { useEffect, useState } from 'react'
import { api, DashboardData, Shipment, Defect } from '@/lib/api'
import { StatCard, SectionTitle, ProgressBar, AlertBanner, Spinner, Tabs } from '@/components/UI'
import { Target, RefreshCw, Truck, AlertTriangle } from 'lucide-react'

type Tab = 'main' | 'shipments' | 'defects'

const DASHBOARD_TABS = [
  { key: 'main',      label: '📊 Головна' },
  { key: 'shipments', label: '🚚 Відправки' },
  { key: 'defects',   label: '⚠️ Брак продукції' },
]

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
    <div>
      <Tabs tabs={DASHBOARD_TABS} active={activeTab} onChange={k => setActiveTab(k as Tab)} variant="underline" />

      {activeTab === 'main' && (
        <div className="space-y-6 animate-fadeIn">
          {data.alerts && data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((alert, idx) => (
                <AlertBanner key={idx} text={alert.text} level={alert.level} />
              ))}
            </div>
          )}

          {/* Картки статистики строго за пропсами з UI.tsx */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Target className="w-4 h-4" />} value={`${data.plan_done}/${data.plan_total}`} label="План циклу" accent="orange" />
            <StatCard icon={<RefreshCw className="w-4 h-4" />} value={data.done_today} label="Зроблено сьогодні" accent="green" />
            <StatCard icon={<Truck className="w-4 h-4" />} value={data.shipped} label="Відправлено" accent="orange" />
            <StatCard icon={<AlertTriangle className="w-4 h-4" />} value={data.in_progress} label="В процесі" accent="yellow" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-surface border border-border p-5 rounded-xl flex flex-col justify-between">
              <div>
                <SectionTitle>Прогрес виконання плану</SectionTitle>
                <div className="text-4xl font-black mt-2 mb-4 text-[var(--orange)] font-display">{pct}%</div>
                <ProgressBar pct={pct} label="виконання плану" subleft={`Залишилось днів: ${data.days_left}`} subright={`Залишилось виробів: ${data.plan_total - data.plan_done}`} />
              </div>
            </div>

            <div className="bg-surface border border-border p-5 rounded-xl">
              <SectionTitle>Фінансовий баланс</SectionTitle>
              <div className="space-y-4 mt-4">
                <div className="flex justify-between items-center bg-black/30 p-3 rounded-lg border border-border/30">
                  <span className="text-xs font-mono uppercase text-[var(--text-dim)]">Базова ставка</span>
                  <span className="text-lg font-bold font-display text-white">{data.salary_base} ₴</span>
                </div>
                <div className="flex justify-between items-center bg-black/30 p-3 rounded-lg border border-border/30">
                  <span className="text-xs font-mono uppercase text-[var(--text-dim)]">Бонуси / Премії</span>
                  <span className="text-lg font-bold font-display text-[var(--green)]">+{data.salary_bonus} ₴</span>
                </div>
                <div className="pt-2 border-t border-border flex justify-between items-center">
                  <span className="text-sm font-bold uppercase tracking-wider text-[var(--text)]">Загалом нараховано</span>
                  <span className="text-2xl font-black font-display text-[var(--orange)]">{data.salary_base + data.salary_bonus} ₴</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'shipments' && (
        <div className="bg-surface border border-border p-5 rounded-xl animate-fadeIn">
          <SectionTitle>Останні логовані відправки</SectionTitle>
          <div className="mt-4 divide-y divide-border">
            {shipments.length === 0 ? (
              <div className="text-sm text-[var(--text-dim)] italic py-2">Записів про відправки не виявлено</div>
            ) : (
              shipments.map((s, idx) => (
                <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[var(--text-dim)]">📅 {s.report_date}</span>
                      <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${s.is_wholesale ? 'bg-amber-950 text-amber-400 border border-amber-800/30' : 'bg-zinc-800 text-zinc-300'
                        }`}>
                        {s.is_wholesale ? '⚡️ Опт' : 'Роздріб'}
                      </span>
                      <span className="text-zinc-500 font-mono text-[11px]">| {s.category}</span>
                    </div>
                    <div className="text-white font-bold mt-0.5">
                      {s.article} <span className="text-[var(--text-dim)] font-normal text-xs">({s.quantity} шт.)</span>
                    </div>
                    {s.extras && Object.keys(s.extras).length > 0 && (
                      <div className="text-[11px] text-[var(--text-dim)] font-mono mt-1 bg-black/20 p-1.5 rounded border border-border/30">
                        {Object.entries(s.extras).map(([key, val]) => (
                          <span key={key} className="mr-3 inline-block">
                            🔧 {key}: <span className="text-zinc-300">{String(val)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {s.pickup_time && (
                    <div className="text-xs font-mono bg-orange-950/40 text-[var(--orange)] border border-orange-900/30 px-2 py-1 rounded self-start sm:self-center">
                      🕒 Самовивіз: {s.pickup_time}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'defects' && (
        <div className="bg-surface border border-border p-5 rounded-xl animate-fadeIn">
          <SectionTitle>Журнал реєстрації браку</SectionTitle>
          <div className="mt-4 divide-y divide-border">
            {defects.length === 0 ? (
              <div className="text-sm text-[var(--text-dim)] italic py-2">Записів про брак не виявлено</div>
            ) : (
              defects.map(d => (
                <div key={d.id} className="py-2.5 border-b border-border last:border-0 text-[var(--text-dim)] text-sm">
                  <div className="flex justify-between font-medium text-[var(--text)]">
                    <span>📅 {new Date(d.defect_date).toLocaleDateString('uk-UA')} | СКУ: <span className="text-[var(--orange)]">{d.sku}</span></span>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-mono ${d.status === 'fixed' ? 'bg-emerald-950 text-[var(--green)]' : 'bg-rose-950 text-red-400'
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