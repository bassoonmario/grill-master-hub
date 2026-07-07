import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ClipboardCheck } from 'lucide-react'
import { Spinner } from '@/components/UI'
import { api } from '@/lib/api'

export interface CheckModalItem {
  name: string
  item_id: string
  table_key: string
  system_qty: number
}

interface Props {
  item: CheckModalItem | null
  onClose: () => void
  onSuccess: () => void
}

export function InventoryCheckModal({ item, onClose, onSuccess }: Props) {
  const [actualQty, setActualQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!item) return null

  const actual = parseFloat(actualQty)
  const delta = actualQty === '' || isNaN(actual) ? null : actual - item.system_qty

  const handleSubmit = async () => {
    const qty = parseFloat(actualQty)
    if (isNaN(qty)) {
      setError('Введіть коректну кількість')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.inventoryCheck(item.item_id, item.table_key, qty)
      onSuccess()
      onClose()
    } catch {
      setError('Помилка збереження. Спробуйте ще раз.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          borderRadius: '16px',
          padding: '20px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        className="w-full max-w-md bg-[#121212] border border-white/10 shadow-2xl space-y-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#c9963a]" />
            <span className="text-white font-mono text-sm uppercase tracking-wider">Інвентаризація</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-0.5">
          <p className="text-white font-mono text-sm">{item.name}</p>
          <p className="text-white/50 font-mono text-xs">
            В системі зараз: <span className="text-[#c9963a]">{item.system_qty} шт</span>
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-white/40 font-mono text-xs uppercase">Фактична кількість</label>
          <input
            type="number"
            inputMode="numeric"
            value={actualQty}
            onChange={e => setActualQty(e.target.value)}
            placeholder="0"
            autoFocus
            className="w-full bg-black border border-white/20 rounded-xl p-4 text-center text-white font-mono text-3xl outline-none focus:border-[#c9963a] transition-colors"
          />
        </div>

        {delta !== null && (
          <div className={`rounded-xl p-3 text-center font-mono text-sm ${
            delta > 0 ? 'bg-green-900/20 text-green-400' :
            delta < 0 ? 'bg-red-900/20 text-red-400' :
            'bg-white/5 text-white/50'
          }`}>
            <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Розбіжність цього разу</p>
            {delta > 0
              ? `+${delta} ↑ надлишок`
              : delta < 0
              ? `${delta} ↓ нестача`
              : '= без змін'}
          </div>
        )}

        {error && (
          <p className="text-red-400 font-mono text-xs text-center">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || actualQty === ''}
          className="w-full bg-[#c9963a] hover:bg-[#b8852f] disabled:opacity-40 text-black font-mono font-semibold text-sm uppercase tracking-wider rounded-xl p-4 transition-colors flex items-center justify-center"
        >
          {saving ? <Spinner /> : 'Зафіксувати інвентаризацію'}
        </button>
      </div>
    </div>,
    document.body
  )
}
