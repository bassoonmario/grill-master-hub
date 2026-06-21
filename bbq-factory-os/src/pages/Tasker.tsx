import { useCallback, useEffect, useState } from 'react'
import { api, DriverTask } from '@/lib/api'
import { SectionTitle, StatusTag, Spinner } from '@/components/UI'
import { Check, ChevronDown, Truck, ClipboardCheck, RefreshCw, ClipboardList, Archive } from 'lucide-react'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function statusToTag(status: string): 'new' | 'progress' | 'done' | 'pending' {
  if (status === 'done' || status === 'completed') return 'done'
  if (status === 'in_progress' || status === 'progress') return 'progress'
  if (status === 'new' || status === 'pending') return 'new'
  return 'pending'
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('uk-UA', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function Tasker() {
  const [tab, setTab] = useState<'active' | 'done'>('active')
  const [tasks, setTasks] = useState<DriverTask[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const data = tab === 'active' 
        ? await api.getDriverTasks() 
        : await api.getDriverTasksDone()
      setTasks(data)
    } catch (e) {
      setError('Не вдалося завантажити завдання')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tab])

  useEffect(() => { loadTasks() }, [loadTasks, tab])

  const activeCount = tab === 'active' ? tasks.filter(
    t => t.status !== 'done' && t.status !== 'completed'
  ).length : 0

  const activeTasks  = tasks.filter(t => t.status !== 'done' && t.status !== 'completed')
  const archivedTasks = tasks.filter(t => t.status === 'done' || t.status === 'completed')

  const tabs: { key: 'active' | 'done'; label: string; icon: React.ReactNode }[] = [
    { key: 'active', label: 'Активні', icon: <ClipboardList size={14} /> },
    { key: 'done', label: 'Виконано', icon: <Archive size={14} /> },
  ]

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 mt-0">
        <SectionTitle>
          Вхідні доручення{' '}
          {activeCount > 0 && (
            <span style={{ color: 'var(--orange)' }}>({activeCount} активних)</span>
          )}
        </SectionTitle>
        <button
          onClick={() => loadTasks(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-lg border transition-all active:scale-95"
          style={{
            borderColor: 'var(--border)',
            color: refreshing ? 'var(--text-dim)' : 'var(--orange)',
          }}
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          оновити
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl border px-4 py-3 mb-3 font-mono text-[12px]"
          style={{ borderColor: 'var(--red)', color: 'var(--red)', background: 'var(--red-dim)' }}
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <Spinner />}

      {/* Empty */}
      {!loading && !error && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <ClipboardCheck size={36} style={{ color: 'var(--text-dim)' }} strokeWidth={1.2} />
          <span className="font-mono text-[11px] tracking-widest text-[var(--text-dim)] uppercase">
            Немає завдань
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-[#0a0a0a] border border-white/5 rounded-xl p-1.5 mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-mono text-[11px] uppercase tracking-wider transition-all ${
              tab === t.key
                ? 'bg-[#c9963a]/20 text-[#c9963a] border border-[#c9963a]/30'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {!loading && tab === 'active' && activeTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onRefresh={() => loadTasks(true)}
          />
        ))}

        {!loading && tab === 'done' && tasks.map(task => (
          <DoneTaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────

function TaskCard({ task, onRefresh }: { task: DriverTask; onRefresh: () => void }) {
  const isDone = task.status === 'done' || task.status === 'completed'

  return task.is_simple
    ? <SimpleTaskCard task={task} onRefresh={onRefresh} />
    : <DeliveryTaskCard task={task} onRefresh={onRefresh} isDone={isDone} />
}

// ─── DONE TASK CARD ───────────────────────────────────────────────────────────

function DoneTaskCard({ task }: { task: DriverTask }) {
  return (
    <div
      className="bg-surface border border-border rounded-xl overflow-hidden opacity-60"
      style={{ background: 'var(--surface2)' }}
    >
      <div className="flex items-start justify-between px-4 py-3 border-b border-white/5 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Archive
            size={14}
            strokeWidth={1.8}
            style={{ color: 'var(--text-dim)', flexShrink: 0 }}
          />
          <div className="min-w-0">
            <div className="font-semibold text-sm leading-tight truncate" style={{ color: 'var(--text)' }}>
              {task.item_id || 'Просте завдання'}
            </div>
            <div className="font-mono text-[9px] text-[var(--text-dim)] mt-0.5">
              #{task.id}
            </div>
          </div>
        </div>
        <StatusTag type="done" />
      </div>

      <div className="px-4 py-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Кількість</span>
          <span className="font-mono text-[12px] text-[var(--text-dim)]">
            {task.actual_qty} / {task.target_qty} шт
          </span>
        </div>

        <div className="flex justify-between items-center pt-1 border-t border-white/5">
          <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Завершено</span>
          <span className="font-mono text-[10px] text-[var(--text-dim)]">
            {formatDate(task.completed_at || '')}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── SIMPLE TASK CARD ─────────────────────────────────────────────────────────

function SimpleTaskCard({ task, onRefresh }: { task: DriverTask; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState<string | null>(null)
  const isDone = task.status === 'done' || task.status === 'completed'

  const handleComplete = async () => {
    setLoading(true)
    setErr(null)
    try {
      await api.completeSimpleTask(task.id)
      onRefresh()
    } catch {
      setErr('Помилка. Спробуйте ще раз.')
      setLoading(false)
    }
  }

  return (
    <div
      className="bg-surface border border-border rounded-xl overflow-hidden transition-opacity"
      style={{ opacity: isDone ? 0.65 : 1 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-border gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <ClipboardCheck
            size={15}
            strokeWidth={1.8}
            style={{ color: 'var(--yellow)', flexShrink: 0 }}
          />
          <div>
            <div className="font-mono text-[10px] text-[var(--text-dim)] tracking-widest uppercase">
              Просте доручення · #{task.id}
            </div>
            <div className="font-mono text-[10px] text-[var(--text-dim)] mt-0.5">
              {formatDate(task.created_at)}
            </div>
          </div>
        </div>
        <StatusTag type={statusToTag(task.status)} />
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {task.admin_comment ? (
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-body)' }}
          >
            {task.admin_comment}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-dim)] italic">Без коментаря</p>
        )}
      </div>

      {/* Error */}
      {err && (
        <div className="px-4 pb-2 font-mono text-[11px]" style={{ color: 'var(--red)' }}>
          {err}
        </div>
      )}

      {/* Action */}
      {!isDone && (
        <div className="px-4 pb-4">
          <button
            onClick={handleComplete}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 font-mono text-[12px] tracking-[2px] py-3 rounded-lg border transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              background:   'var(--green-dim)',
              borderColor:  'var(--green)',
              color:        'var(--green)',
            }}
          >
            {loading ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Check size={14} strokeWidth={2.5} />
            )}
            {loading ? 'ЗБЕРЕЖЕННЯ...' : 'ВИКОНАНО'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── DELIVERY TASK CARD ───────────────────────────────────────────────────────

function DeliveryTaskCard({
  task, onRefresh, isDone
}: {
  task: DriverTask; onRefresh: () => void; isDone: boolean
}) {
  const [open, setOpen]             = useState(false)
  const [destination, setDest]      = useState<'main' | 'operative'>('main')
  const [qty, setQty]               = useState('')
  const [loading, setLoading]       = useState(false)
  const [err, setErr]               = useState<string | null>(null)

  const pct = task.target_qty > 0
    ? Math.min(100, Math.round((task.actual_qty / task.target_qty) * 100))
    : 0

  const handleDeliver = async () => {
  const amount = parseInt(qty, 10)
  if (!amount || amount <= 0) {
    setErr('Введіть коректну кількість')
    return
  }

  setLoading(true)
  setErr(null)

  try {
    await api.deliverTask(task.id, destination, amount)
    setOpen(false)
    setQty('')
  } catch {
    setErr('Помилка доставки. Спробуйте ще раз.')
  } finally {
    setLoading(false)
    onRefresh()
  }
}

  return (
    <div
      className="bg-surface border border-border rounded-xl overflow-hidden transition-opacity"
      style={{ opacity: isDone ? 0.65 : 1 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-border gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Truck
            size={15}
            strokeWidth={1.8}
            style={{ color: 'var(--orange)', flexShrink: 0 }}
          />
          <div className="min-w-0">
            <div
              className="font-semibold text-sm leading-tight truncate"
              style={{ color: 'var(--text)' }}
            >
              {task.item_id}
            </div>
            <div className="font-mono text-[10px] text-[var(--text-dim)] mt-0.5">
              #{task.id} · {formatDate(task.created_at)}
            </div>
          </div>
        </div>
        <StatusTag type={statusToTag(task.status)} />
      </div>

      {/* Progress */}
      <div className="px-4 pt-3 pb-3">
        {/* Qty row */}
        <div className="flex justify-between items-baseline mb-2">
          <span className="font-mono text-[11px] text-[var(--text-dim)] tracking-wider uppercase">
            Прогрес
          </span>
          <span className="font-display text-lg" style={{ color: 'var(--orange)' }}>
            {task.actual_qty}
            <span className="font-mono text-[13px] text-[var(--text-dim)]">
              /{task.target_qty}
            </span>
          </span>
        </div>

        {/* Bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: pct >= 100
                ? 'var(--green)'
                : 'linear-gradient(90deg, var(--orange), #e8a84a)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="font-mono text-[10px] text-[var(--text-dim)]">доставлено</span>
          <span className="font-mono text-[10px]" style={{
            color: pct >= 100 ? 'var(--green)' : 'var(--orange)'
          }}>{pct}%</span>
        </div>

        {/* Admin comment */}
        {task.admin_comment && (
          <div
            className="mt-3 px-3 py-2 rounded-lg border font-mono text-[11px] leading-relaxed"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text-dim)',
            }}
          >
            <span style={{ color: 'var(--yellow)' }}>Коментар: </span>
            {task.admin_comment}
          </div>
        )}
      </div>

      {/* Error */}
      {err && (
        <div className="px-4 pb-2 font-mono text-[11px]" style={{ color: 'var(--red)' }}>
          {err}
        </div>
      )}

      {/* Deliver action */}
      {!isDone && (
        <div className="px-4 pb-4">
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="w-full flex items-center justify-center gap-2 font-mono text-[12px] tracking-[2px] py-3 rounded-lg border transition-all active:scale-[0.98]"
              style={{
                background:   'transparent',
                borderColor:  'var(--orange)',
                color:        'var(--orange)',
              }}
            >
              <Truck size={13} />
              ПІДТВЕРДИТИ ДОСТАВКУ
              <ChevronDown size={13} />
            </button>
          ) : (
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--orange)', background: 'var(--surface2)' }}
            >
              {/* Destination toggle */}
              <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
                {(['main', 'operative'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDest(d)}
                    className="flex-1 py-2.5 font-mono text-[11px] tracking-widest uppercase transition-all"
                    style={{
                      background:   destination === d ? 'var(--orange-dim)' : 'transparent',
                      color:        destination === d ? 'var(--orange)'     : 'var(--text-dim)',
                      borderRight:  d === 'main' ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {d === 'main' ? 'Основний' : 'Майстерня'}
                  </button>
                ))}
              </div>

              {/* Qty input */}
              <div className="flex items-center gap-3 px-3 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="font-mono text-[11px] text-[var(--text-dim)] tracking-wider whitespace-nowrap">
                  Кількість:
                </span>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={e => { setQty(e.target.value); setErr(null) }}
                  placeholder="0"
                  className="flex-1 bg-transparent font-mono text-base text-right outline-none"
                  style={{ color: 'var(--text)' }}
                />
                <span className="font-mono text-[11px] text-[var(--text-dim)]">шт</span>
              </div>

              {/* Confirm / Cancel */}
              <div className="flex">
                <button
                  onClick={() => { setOpen(false); setQty(''); setErr(null) }}
                  className="flex-1 py-3 font-mono text-[11px] tracking-widest uppercase transition-all active:scale-95"
                  style={{
                    color:       'var(--text-dim)',
                    borderRight: '1px solid var(--border)',
                  }}
                >
                  Скасувати
                </button>
                <button
                  onClick={handleDeliver}
                  disabled={loading || !qty}
                  className="flex-1 flex items-center justify-center gap-2 py-3 font-mono text-[11px] tracking-widest uppercase transition-all active:scale-95 disabled:opacity-50"
                  style={{ color: 'var(--orange)' }}
                >
                  {loading ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} strokeWidth={2.5} />
                  )}
                  {loading ? 'Збереження' : 'Зберегти'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
