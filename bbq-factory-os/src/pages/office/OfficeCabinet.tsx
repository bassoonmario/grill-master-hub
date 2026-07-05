import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, Spinner, EmptyState, SectionTitle } from '@/components/UI'
import { api, OfficeTask, OfficeStockRow } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Plus, ClipboardList, Store, Package, Send, AlertCircle, CheckCircle2, ClipboardCheck } from 'lucide-react'
import { OfficeGrillsView } from './OfficeGrillsTab'

type TabKey = 'create' | 'tasks' | 'shop' | 'grills'

export function OfficeCabinet() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as TabKey) || 'create'

  const setTab = (k: TabKey) => setSearchParams({ tab: k })

  const tabs = [
    { key: 'create', label: 'Створити', icon: <Plus className="w-4 h-4" /> },
    { key: 'tasks',  label: 'Таски',    icon: <ClipboardList className="w-4 h-4" /> },
    { key: 'shop',   label: 'Магазин',  icon: <Store className="w-4 h-4" /> },
    { key: 'grills', label: 'Грилі',    icon: <Package className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6 pb-20">
      <SectionTitle>Кабінет офісу</SectionTitle>
      <Tabs tabs={tabs} active={tab} onChange={k => setTab(k as TabKey)} variant="underline" />

      {tab === 'create' && <CreateTaskTab />}
      {tab === 'tasks'  && <TasksTab />}
      {tab === 'shop'   && <ShopTab />}
      {tab === 'grills' && <OfficeGrillsView />}
    </div>
  )
}

// ─── СТВОРИТИ ЗАВДАННЯ ──────────────────────────────────────────────────────

function CreateTaskTab() {
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = async () => {
    if (!comment.trim()) { setError('Введіть текст завдання'); return }
    setSaving(true); setError(null); setSuccess(null)
    try {
      await api.createOfficeTask(comment.trim(), user?.name)
      setComment('')
      setSuccess('Завдання створено і надіслано водію')
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
        <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">Текст завдання для водія</label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={5}
          placeholder="Наприклад: привезти в офіс 2 G12, 1 G8H..."
          className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors resize-none"
        />
      </div>
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getOfficeTasks()
      setTasks(data)
    } catch (e) {
      setError('Не вдалося завантажити таски')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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
          {archived.length > 0 && (
            <div className="pt-4">
              <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest mb-2">Архів</div>
              {archived.map(t => (
                <div key={t.id} className="bg-[#0e0e0e] border border-white/5 rounded-xl p-4 opacity-50 mb-2">
                  <p className="text-white/50 font-mono text-xs">{t.admin_comment}</p>
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
  const canConfirm = task.status === 'прийнято'
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

  return (
    <div className="bg-[#121212] border border-white/10 rounded-xl p-4 space-y-2">
      <p className="text-white font-mono text-sm break-words">{task.admin_comment}</p>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-white/30 uppercase">{task.status}</span>
        <span className="text-[9px] font-mono text-white/20">{task.created_at}</span>
      </div>
      {canConfirm && !isConfirming && (
        <button
          onClick={onConfirmClick}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border font-mono text-[11px] uppercase tracking-wider"
          style={{ borderColor: 'var(--orange)', color: 'var(--orange)' }}
        >
          <ClipboardCheck className="w-4 h-4" /> Підтвердити отримання
        </button>
      )}
      {canConfirm && isConfirming && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          {err && <div className="text-red-400 font-mono text-[11px]">{err}</div>}
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
              style={{ color: row.quantity <= row.min_qty ? 'var(--red)' : undefined }}
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
