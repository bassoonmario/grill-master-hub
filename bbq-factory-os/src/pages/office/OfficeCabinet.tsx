import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, Spinner, EmptyState, SectionTitle, PriorityBadge } from '@/components/UI'
import { api, OfficeTask, OfficeStockRow, InventoryOperativeOption, IncomingTask } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { ClipboardList, Send, AlertCircle, CheckCircle2, ClipboardCheck, Check, Truck, User } from 'lucide-react'
import type { AssigneeRole, TaskPriority, OfficeTaskVariant } from '@/lib/api'
import { OfficeGrillsView } from './OfficeGrillsTab'
import { OfficePickupTab } from './OfficePickupTab'

type TabKey = 'create' | 'tasks' | 'shop' | 'grills'

export function OfficeCabinet() {
  const [searchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as TabKey) || 'create'

  return (
    <div className="space-y-6 pb-20">
      <SectionTitle>Кабінет офісу</SectionTitle>

      {tab === 'create' && <CreateTaskTab />}
      {tab === 'tasks'  && <TasksTab />}
      {tab === 'shop'   && <OfficeShopSection />}
      {tab === 'grills' && <OfficeGrillsView />}
    </div>
  )
}

// ─── МАГАЗИН: САМОВИВОЗИ / ТАБЛИЦЯ ──────────────────────────────────────────

function OfficeShopSection() {
  const [subTab, setSubTab] = useState<'pickup' | 'table'>('pickup')
  const subTabs = [
    { key: 'pickup', label: 'Самовивози' },
    { key: 'table',  label: 'Таблиця магазину' },
  ]
  return (
    <div>
      <Tabs tabs={subTabs} active={subTab} onChange={k => setSubTab(k as 'pickup' | 'table')} variant="underline" />
      {subTab === 'pickup' && <OfficePickupTab />}
      {subTab === 'table'  && <ShopTab />}
    </div>
  )
}

// ─── СТВОРИТИ ЗАВДАННЯ ──────────────────────────────────────────────────────

const PRIORITY_OPTIONS: { key: TaskPriority; label: string; color: string; dim: string }[] = [
  { key: 'none',   label: 'Немає',    color: 'var(--text-dim)', dim: 'transparent' },
  { key: 'low',    label: 'Низький',  color: 'var(--green)',    dim: 'var(--green-dim)' },
  { key: 'medium', label: 'Середній', color: 'var(--orange)',   dim: 'var(--orange-dim)' },
  { key: 'high',   label: 'Високий',  color: 'var(--red)',      dim: 'var(--red-dim)' },
]

function CreateTaskTab() {
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [assigneeRole, setAssigneeRole] = useState<AssigneeRole>('driver')
  const [priority, setPriority] = useState<TaskPriority>('none')
  const [taskVariant, setTaskVariant] = useState<OfficeTaskVariant>('receive')
  const [componentRef, setComponentRef] = useState('')
  const [qtyText, setQtyText] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [options, setOptions] = useState<InventoryOperativeOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isMasterSimple = assigneeRole === 'master' && taskVariant === 'simple'

  useEffect(() => {
    if (assigneeRole !== 'master' || options.length > 0) return
    api.getOfficeInventoryOperativeOptions().then(setOptions).catch(() => {})
  }, [assigneeRole, options.length])

  const submit = async () => {
    if (isMasterSimple) {
      if (!componentRef) { setError('Оберіть компонент зі списку'); return }
    } else if (!comment.trim()) {
      setError('Введіть текст завдання'); return
    }
    setSaving(true); setError(null); setSuccess(null)
    try {
      const selectedLabel = options.find(o => o.item_id === componentRef)?.label ?? componentRef
      const finalComment = isMasterSimple
        ? `${selectedLabel}${qtyText.trim() ? ` — ${qtyText.trim()}` : ''}`
        : comment.trim()
      await api.createOfficeTask(
        finalComment,
        user?.name,
        assigneeRole,
        priority,
        isMasterSimple ? 'simple' : 'receive',
        (isMasterSimple || assigneeRole === 'driver') && dueDate ? dueDate : undefined,
        isMasterSimple ? componentRef : undefined,
      )
      setComment('')
      setComponentRef('')
      setQtyText('')
      setDueDate('')
      setAssigneeRole('driver')
      setTaskVariant('receive')
      setPriority('none')
      setSuccess(assigneeRole === 'master' ? 'Завдання створено і надіслано майстру' : 'Завдання створено і надіслано водію')
    } catch (e) {
      setError('Помилка створення завдання')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 rounded-xl flex items-center gap-3 text-sm font-mono border"
          style={{ background: 'var(--red-dim)', borderColor: 'var(--red)', color: '#e08080' }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl flex items-center gap-3 text-sm font-mono border"
          style={{ background: 'var(--green-dim)', borderColor: 'var(--green)', color: '#7fd99a' }}>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div>
        <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Кому</label>
        <div className="flex gap-2">
          <button
            onClick={() => setAssigneeRole('driver')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all border ${
              assigneeRole === 'driver'
                ? 'bg-[#c9963a]/15 text-[#c9963a] border-[#c9963a]/40'
                : 'bg-[#121212] text-white/40 border-white/10 hover:border-white/20'
            }`}
          >
            <Truck className="w-4 h-4" /> Водій
          </button>
          <button
            onClick={() => setAssigneeRole('master')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all border ${
              assigneeRole === 'master'
                ? 'bg-[#c9963a]/15 text-[#c9963a] border-[#c9963a]/40'
                : 'bg-[#121212] text-white/40 border-white/10 hover:border-white/20'
            }`}
          >
            <User className="w-4 h-4" /> Майстер (Вова)
          </button>
        </div>
      </div>

      {assigneeRole === 'master' && (
        <div>
          <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Тип завдання</label>
          <div className="flex gap-2">
            <button
              onClick={() => setTaskVariant('receive')}
              className={`flex-1 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all border ${
                taskVariant === 'receive'
                  ? 'bg-[#c9963a]/15 text-[#c9963a] border-[#c9963a]/40'
                  : 'bg-[#121212] text-white/40 border-white/10 hover:border-white/20'
              }`}
            >
              Отримання
            </button>
            <button
              onClick={() => setTaskVariant('simple')}
              className={`flex-1 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all border ${
                taskVariant === 'simple'
                  ? 'bg-[#c9963a]/15 text-[#c9963a] border-[#c9963a]/40'
                  : 'bg-[#121212] text-white/40 border-white/10 hover:border-white/20'
              }`}
            >
              Просте
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Пріоритет</label>
        <div className="flex gap-2">
          {PRIORITY_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setPriority(opt.key)}
              className="flex-1 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-wider transition-all border"
              style={{
                background:  priority === opt.key ? opt.dim : '#121212',
                borderColor: priority === opt.key ? opt.color : 'rgba(255,255,255,0.1)',
                color:       priority === opt.key ? opt.color : 'rgba(255,255,255,0.4)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isMasterSimple ? (
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">Компонент</label>
            <select
              value={componentRef}
              onChange={e => setComponentRef(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors"
            >
              <option value="">Оберіть компонент...</option>
              {options.map(o => (
                <option key={o.item_id} value={o.item_id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">Кількість</label>
            <input
              type="text"
              value={qtyText}
              onChange={e => setQtyText(e.target.value)}
              placeholder="Наприклад: 20 шт"
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">Термін (опційно)</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors"
            />
          </div>
        </div>
      ) : (
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">
              Текст завдання для {assigneeRole === 'master' ? 'майстра' : 'водія'}
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={5}
              placeholder="Наприклад: привезти в офіс 2 G12, 1 G8H..."
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors resize-none"
            />
          </div>
          {assigneeRole === 'driver' && (
            <div className="w-36 flex-shrink-0">
              <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">
                Виконати до
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-white font-mono text-xs outline-none focus:border-[#c9963a]/50 transition-colors"
              />
            </div>
          )}
        </div>
      )}
      <button
        onClick={submit}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-xs uppercase tracking-wider bg-[#c9963a] text-black font-bold disabled:opacity-50"
      >
        {saving ? <Spinner /> : <><Send className="w-4 h-4" />Створити завдання</>}
      </button>
    </div>
  )
}

// ─── ТАСКИ ОФІСУ (активні + архів) ──────────────────────────────────────────

function TasksTab() {
  const [tasks, setTasks] = useState<OfficeTask[]>([])
  const [adminDriverTasks, setAdminDriverTasks] = useState<IncomingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, adminTasks] = await Promise.all([
        api.getOfficeTasks(),
        api.getAdminDriverTasks(),
      ])
      setTasks(data)
      setAdminDriverTasks(adminTasks)
    } catch (e) {
      setError('Не вдалося завантажити таски')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  const active = tasks.filter(t => t.status !== 'архів')
  const archived = tasks.filter(t => t.status === 'архів')

  return (
    <div className="space-y-3">
      {error && <div className="text-red-400 font-mono text-xs">{error}</div>}
      {loading ? <Spinner /> : (
        <>
          {tasks.length === 0 && <EmptyState icon={<ClipboardList size={36} strokeWidth={1.2} />} text="Немає своїх завдань" />}
          {active.map(t => (
            <OfficeTaskCard
              key={t.id}
              task={t}
              onConfirmClick={() => setConfirmingId(t.id)}
              isConfirming={confirmingId === t.id}
              onClose={() => setConfirmingId(null)}
              onDone={() => { setConfirmingId(null); load() }}
            />
          ))}
          {adminDriverTasks.map(t => (
            <div key={`admin-${t.id}`} className="bg-[#121212] border border-white/5 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <PriorityBadge priority={t.priority} />
                <span className="text-[9px] font-mono text-white/30 uppercase bg-white/5 px-2 py-0.5 rounded">адмін · водію</span>
                <span className="text-[9px] font-mono text-white/30 uppercase ml-auto">{t.status}</span>
              </div>
              <p className="text-white font-mono text-sm break-words">
                {t.item_id || t.admin_comment || `Завдання #${t.id}`}
              </p>
              {t.target_qty > 0 && (
                <p className="text-white/40 font-mono text-xs">{t.actual_qty ?? 0} / {t.target_qty} шт</p>
              )}
              {t.driver_comment && (
                <p className="text-white/30 font-mono text-[11px]">Коментар водія: {t.driver_comment}</p>
              )}
              <span className="text-[9px] font-mono text-white/20 block">{t.created_at}</span>
            </div>
          ))}
          {archived.length > 0 && (
            <div className="pt-4">
              <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest mb-2">Архів</div>
              {archived.map(t => (
                <div key={t.id} className="bg-[#0e0e0e] border border-white/5 rounded-xl p-4 opacity-50 mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <p className="text-white/50 font-mono text-xs line-through decoration-white/30">{t.admin_comment}</p>
                  <span className="text-[9px] font-mono text-white/15">{t.created_at}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function OfficeTaskCard({ task, onConfirmClick, isConfirming, onClose, onDone }: {
  task: OfficeTask
  onConfirmClick: () => void
  isConfirming: boolean
  onClose: () => void
  onDone: () => void
}) {
  const isSimpleVariant = task.assignee_role === 'master' && !!task.component_ref
  const canConfirm = task.assignee_role === 'master' && task.status !== 'архів'
  const [items, setItems] = useState<{ item_id: string; qty: string }[]>([{ item_id: '', qty: '' }])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const addRow = () => setItems(prev => [...prev, { item_id: '', qty: '' }])
  const updateRow = (i: number, field: 'item_id' | 'qty', value: string) =>
    setItems(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const submit = async () => {
    const parsed = items
      .filter(r => r.item_id && parseInt(r.qty) > 0)
      .map(r => ({ item_id: r.item_id, qty: parseInt(r.qty) }))
    if (parsed.length === 0) { setErr('Додайте хоча б один артикул з кількістю'); return }
    setSaving(true); setErr(null)
    try {
      await api.receiveOfficeStock(task.id, parsed)
      onDone()
    } catch (e: any) {
      setErr(e.message ?? 'Помилка збереження')
    } finally {
      setSaving(false)
    }
  }

  const submitSimple = async () => {
    setSaving(true); setErr(null)
    try {
      await api.completeSimpleTask(task.id)
      onDone()
    } catch (e: any) {
      setErr(e.message ?? 'Помилка збереження')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-[#121212] border border-white/10 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <PriorityBadge priority={task.priority} />
        {task.assignee_role === 'master' && (
          <span className="text-[9px] font-mono text-white/30 uppercase bg-white/5 px-2 py-0.5 rounded">майстру</span>
        )}
      </div>
      <p className="text-white font-mono text-sm break-words">{task.admin_comment}</p>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-white/30 uppercase">{task.status}</span>
        <span className="text-[9px] font-mono text-white/20">{task.due_date ? `до ${task.due_date}` : task.created_at}</span>
      </div>
      {err && <div className="text-red-400 font-mono text-[11px]">{err}</div>}
      {canConfirm && isSimpleVariant && (
        <button
          onClick={submitSimple}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border font-mono text-[11px] uppercase tracking-wider disabled:opacity-50"
          style={{ borderColor: 'var(--green)', color: 'var(--green)', background: 'var(--green-dim)' }}
        >
          <Check className="w-4 h-4" /> {saving ? 'Збереження...' : 'Підтвердити'}
        </button>
      )}
      {canConfirm && !isSimpleVariant && !isConfirming && (
        <button
          onClick={onConfirmClick}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border font-mono text-[11px] uppercase tracking-wider"
          style={{ borderColor: 'var(--orange)', color: 'var(--orange)' }}
        >
          <ClipboardCheck className="w-4 h-4" /> Підтвердити отримання
        </button>
      )}
      {canConfirm && !isSimpleVariant && isConfirming && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          {items.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder="Артикул (напр. G12)"
                value={row.item_id}
                onChange={e => updateRow(i, 'item_id', e.target.value.toUpperCase())}
                className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-lg p-2 text-white font-mono text-xs outline-none"
              />
              <input
                type="number"
                placeholder="К-ть"
                value={row.qty}
                onChange={e => updateRow(i, 'qty', e.target.value)}
                className="w-20 bg-[#0a0a0a] border border-white/10 rounded-lg p-2 text-white font-mono text-xs outline-none"
              />
            </div>
          ))}
          <button onClick={addRow} className="text-[10px] font-mono text-white/40 uppercase">+ ще артикул</button>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-white/50 font-mono text-[11px] uppercase">Скасувати</button>
            <button onClick={submit} disabled={saving} className="flex-1 py-2 rounded-lg bg-[#c9963a] text-black font-mono text-[11px] uppercase font-bold disabled:opacity-50">
              {saving ? '...' : 'Зберегти'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── МАГАЗИН (office_stock) ─────────────────────────────────────────────────

function ShopTab() {
  const [rows, setRows] = useState<OfficeStockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getOfficeStock()
      setRows(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (row: OfficeStockRow) => {
    setEditingId(row.item_id)
    setEditValue(String(row.quantity))
  }

  const saveEdit = async (item_id: string) => {
    const qty = parseInt(editValue)
    if (isNaN(qty)) { setEditingId(null); return }
    try {
      await api.updateOfficeStock(item_id, qty)
      setRows(prev => prev.map(r => r.item_id === item_id ? { ...r, quantity: qty } : r))
    } finally {
      setEditingId(null)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="bg-[#121212] border border-white/10 rounded-xl overflow-hidden">
      <div className="grid grid-cols-3 px-3 py-2 bg-[#0a0a0a]">
        <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">Артикул</span>
        <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">К-сть</span>
        <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">Остання поставка</span>
      </div>
      {rows.map(row => (
        <div key={row.item_id} className="grid grid-cols-3 px-3 py-2.5 border-t border-white/5 items-center">
          <span className="font-mono text-xs text-white">{row.item_id}</span>
          {editingId === row.item_id ? (
            <input
              autoFocus
              type="number"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => saveEdit(row.item_id)}
              onKeyDown={e => e.key === 'Enter' && saveEdit(row.item_id)}
              className="w-16 bg-[#0a0a0a] border border-[#c9963a]/50 rounded p-1 text-white font-mono text-xs outline-none"
            />
          ) : (
            <button
              onClick={() => startEdit(row)}
              className="text-left font-mono text-xs"
              style={{
                color: row.quantity <= row.min_qty
                  ? 'var(--red)'
                  : row.quantity <= row.min_qty * 1.5
                    ? 'var(--yellow)'
                    : undefined
              }}
            >
              {row.quantity}
            </button>
          )}
          <span className="font-mono text-[10px] text-white/30">{row.last_delivery_date || '—'}</span>
        </div>
      ))}
    </div>
  )
}
