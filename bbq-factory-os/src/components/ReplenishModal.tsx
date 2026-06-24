import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/lib/api'

export interface ReplenishItem {
  id: string
  name: string
  unit_type: string
  conversion_factor: number
  is_internal?: boolean
}

interface ReplenishModalProps {
  item: ReplenishItem | null
  onClose: () => void
  onSuccess: () => void
  showWarehouseSelect?: boolean
}

const unitLabel = (unit_type: string) => {
  const labels: Record<string, string> = { pcs: 'шт', kg: 'кг', roll: 'мотки', strip: 'полоски' }
  return labels[unit_type] || 'шт'
}

const resultLabel = (unit_type: string) => {
  const labels: Record<string, string> = { pcs: 'шт', kg: 'шт', roll: 'м', strip: 'шт' }
  return labels[unit_type] || 'шт'
}

export function ReplenishModal({ item, onClose, onSuccess, showWarehouseSelect = false }: ReplenishModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [warehouse, setWarehouse] = useState<'main' | 'operative'>('main')
  const [loading, setLoading] = useState(false)

  if (!item) return null

  const handleSubmit = async () => {
    if (!inputValue) return
    const val = parseFloat(inputValue)
    if (isNaN(val) || val <= 0) return
    setLoading(true)
    try {
      await api.replenishComponent(parseInt(item.id), val, showWarehouseSelect ? warehouse : undefined)
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
      setInputValue('')
    }
  }

  const converted = inputValue ? Math.round(parseFloat(inputValue) * item.conversion_factor) : null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#121212] border border-white/10 rounded-xl p-6 w-80">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-display text-lg">{item.name}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {showWarehouseSelect && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setWarehouse('main')}
              className={`flex-1 py-1.5 rounded text-xs font-mono border transition-colors ${warehouse === 'main' ? 'bg-[#c9963a]/20 border-[#c9963a] text-[#c9963a]' : 'border-white/10 text-white/40'}`}
            >
              Основний
            </button>
            <button
              onClick={() => setWarehouse('operative')}
              className={`flex-1 py-1.5 rounded text-xs font-mono border transition-colors ${warehouse === 'operative' ? 'bg-[#c9963a]/20 border-[#c9963a] text-[#c9963a]' : 'border-white/10 text-white/40'}`}
            >
              Майстерня
            </button>
          </div>
        )}

        <label className="text-white/40 text-xs font-mono uppercase">
          Кількість ({unitLabel(item.unit_type)})
        </label>
        <input
          type="number"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          className="w-full bg-black border border-[#c9963a] rounded p-2 text-white font-mono mt-1 outline-none"
          placeholder="0"
          autoFocus
        />
        {converted !== null && (
          <p className="text-white/40 text-xs font-mono mt-1">
            = {converted} {resultLabel(item.unit_type)}
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-[#c9963a] text-black font-mono text-sm py-2 rounded font-bold"
          >
            {loading ? '...' : 'Поповнити'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-white/20 text-white/60 font-mono text-sm py-2 rounded"
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  )
}
