import { useState, useEffect, useMemo } from 'react'
import { SectionTitle, Tabs, Spinner, EmptyState } from '@/components/UI'
import { api, WriteoffLog } from '@/lib/api'
import { ChevronDown, ChevronUp } from 'lucide-react'

const OPERATION_MAP: Record<string, { label: string; className: string }> = {
  write_off_finished:  { label: 'спаковані',      className: 'bg-[#2a6b3a28] text-green-400 border border-[#2a6b3a66]' },
  write_off_case:      { label: 'кейс',           className: 'bg-[#c9963a20] text-[#c9963a] border border-[#c9963a40]' },
  write_off_component: { label: 'комплектуючі',   className: 'bg-blue-900/20 text-blue-400 border border-blue-800/40' },
  write_off_direct:    { label: 'пряме списання', className: 'bg-[#3a3530] text-[#9a9088] border border-[#5a5248]' },
  write_off_box:       { label: 'ящики',          className: 'bg-purple-900/20 text-purple-400 border border-purple-800/40' },
}

const INPUT_CLS = 'bg-[#111009] border border-[#3a3530] text-[#e8e0d0] font-mono text-xs rounded px-2 py-1.5 outline-none'

function OperationBadge({ op }: { op: string }) {
  const { label, className } = OPERATION_MAP[op] ?? { label: op, className: 'bg-[#3a3530] text-[#9a9088]' }
  return (
    <span className={`font-mono text-[10px] rounded px-2 py-0.5 ${className}`}>
      {label}
    </span>
  )
}

function WriteoffLogs() {
  const [logs, setLogs] = useState<WriteoffLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [operation, setOperation] = useState('')
  const [search, setSearch] = useState('')

  const [openSessions, setOpenSessions] = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getWriteoffLogs({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        operation: operation || undefined,
        search: search || undefined,
      })
      setLogs(data)
    } catch (e: any) {
      setError(e.message ?? 'Помилка завантаження')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, { dt: string; rows: WriteoffLog[] }>()
    for (const log of logs) {
      if (!map.has(log.session_id)) {
        map.set(log.session_id, { dt: log.dt_create, rows: [] })
      }
      map.get(log.session_id)!.rows.push(log)
    }
    return Array.from(map.entries())
  }, [logs])

  const toggleSession = (sid: string) => {
    setOpenSessions(prev => {
      const next = new Set(prev)
      next.has(sid) ? next.delete(sid) : next.add(sid)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] text-[#5a5248] uppercase tracking-widest">Від</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={INPUT_CLS} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] text-[#5a5248] uppercase tracking-widest">До</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={INPUT_CLS} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] text-[#5a5248] uppercase tracking-widest">Операція</span>
          <select value={operation} onChange={e => setOperation(e.target.value)} className={INPUT_CLS}>
            <option value="">Всі</option>
            {Object.entries(OPERATION_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <span className="font-mono text-[10px] text-[#5a5248] uppercase tracking-widest">Пошук</span>
          <input
            type="text"
            placeholder="артикул / компонент"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${INPUT_CLS} placeholder:text-[#3a3530]`}
          />
        </div>
        <button
          onClick={load}
          className="px-4 py-1.5 bg-[#c9963a20] text-[#c9963a] border border-[#c9963a40] font-mono text-xs rounded hover:bg-[#c9963a30] transition-colors"
        >
          Застосувати
        </button>
      </div>

      {/* States */}
      {loading && <div className="flex justify-center py-10"><Spinner /></div>}
      {error && <p className="font-mono text-xs text-red-400 py-2">{error}</p>}
      {!loading && !error && grouped.length === 0 && (
        <EmptyState text="Немає записів для відображення" />
      )}

      {/* Accordions */}
      {!loading && !error && grouped.map(([sid, { dt, rows }]) => {
        const isOpen = openSessions.has(sid)
        const articles = [...new Set(rows.map(l => l.article))].join(', ')
        return (
          <div key={sid} className="border border-[#3a3530] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSession(sid)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left bg-[#111009] hover:bg-[#1a1510] transition-colors"
            >
              <span className="font-mono text-xs text-[#e8e0d0]">
                {dt} — <span className="text-[#9a9088]">{articles}</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[10px] bg-[#c9963a20] text-[#c9963a] border border-[#c9963a40] rounded px-2 py-0.5">
                  {rows.length} записів
                </span>
                {isOpen
                  ? <ChevronUp className="w-3.5 h-3.5 text-[#5a5248]" />
                  : <ChevronDown className="w-3.5 h-3.5 text-[#5a5248]" />
                }
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-[#3a3530]">
                <div className="grid grid-cols-4 px-3 py-1.5 bg-[#080808]">
                  <span className="font-mono text-[10px] text-[#5a5248] uppercase tracking-widest">Артикул</span>
                  <span className="font-mono text-[10px] text-[#5a5248] uppercase tracking-widest">Компонент</span>
                  <span className="font-mono text-[10px] text-[#5a5248] uppercase tracking-widest">Кількість</span>
                  <span className="font-mono text-[10px] text-[#5a5248] uppercase tracking-widest">Операція</span>
                </div>
                {rows.map(row => (
                  <div
                    key={row.id}
                    className="grid grid-cols-4 px-3 py-2 border-t border-[#3a3530]/50 hover:bg-[#1a1510] items-center"
                  >
                    <span className="font-mono text-xs text-[#e8e0d0]">{row.article}</span>
                    <span className="font-mono text-xs text-[#e8e0d0]">{row.component}</span>
                    <span className="font-mono text-xs text-red-400">{row.qty}</span>
                    <OperationBadge op={row.operation} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const SYSTEM_TABS = [
  { key: 'logs',          label: 'Логи списань' },
  { key: 'recipes',       label: 'Рецепти грилів' },
  { key: 'recipes_cases', label: 'Рецепти кейсів' },
]

export function AdminSystem() {
  const [activeTab, setActiveTab] = useState('logs')

  return (
    <div className="space-y-4">
      <SectionTitle>Система</SectionTitle>

      <Tabs tabs={SYSTEM_TABS} active={activeTab} onChange={setActiveTab} variant="underline" />

      {activeTab === 'logs' && <WriteoffLogs />}

      {activeTab === 'recipes' && (
        <EmptyState text="Буде реалізовано пізніше" />
      )}

      {activeTab === 'recipes_cases' && (
        <EmptyState text="Буде реалізовано пізніше" />
      )}
    </div>
  )
}
