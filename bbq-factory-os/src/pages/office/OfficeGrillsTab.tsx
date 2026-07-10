import { useState, useEffect, useCallback } from 'react'
import { Spinner } from '@/components/UI'
import { api } from '@/lib/api'
import { Pencil, Check, X } from 'lucide-react'

interface GrillRow {
  sku: string
  name: string
  cases_empty: number
  ready: number
  finished_main: number
  finished_main_min?: number
  finished_main_max?: number
}

export function OfficeGrillsView() {
  const [rows, setRows] = useState<GrillRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSku, setEditingSku] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const items = await api.stock()
      const grillsMap = new Map<string, GrillRow>()
      for (const i of items) {
        if (!['cases_empty', 'ready', 'finished_main'].includes(i.category)) continue
        if (!grillsMap.has(i.sku)) grillsMap.set(i.sku, { sku: i.sku, name: i.name || i.sku, cases_empty: 0, ready: 0, finished_main: 0 })
        const entry = grillsMap.get(i.sku)!
        if (i.category === 'cases_empty') entry.cases_empty = i.qty
        if (i.category === 'ready') entry.ready = i.qty
        if (i.category === 'finished_main') {
          entry.finished_main = i.qty
          entry.finished_main_min = i.min_limit
          entry.finished_main_max = i.max_limit
        }
      }
      setRows(Array.from(grillsMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e) {
      setError('Помилка завантаження')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (row: GrillRow) => {
    setEditingSku(row.sku)
    setEditValues({
      cases_empty: String(row.cases_empty),
      ready: String(row.ready),
      finished_main: String(row.finished_main),
    })
    setError(null)
  }

  const cancelEdit = () => {
    setEditingSku(null)
    setEditValues({})
  }

  const saveEdit = async (row: GrillRow) => {
    setIsSyncing(true)
    setError(null)
    let hasError = false
    try {
      const vEmpty = parseInt(editValues.cases_empty)
      const vReady = parseInt(editValues.ready)
      const vMain = parseInt(editValues.finished_main)

      if (!isNaN(vEmpty) && vEmpty >= 0 && vEmpty !== row.cases_empty) await api.updateInventory('cases_empty', row.sku, vEmpty)
      if (!isNaN(vReady) && vReady >= 0 && vReady !== row.ready) await api.updateInventory('finished', row.sku, vReady)
      if (!isNaN(vMain) && vMain >= 0 && vMain !== row.finished_main) await api.updateInventory('finished_main', row.sku, vMain)
    } catch (e) {
      hasError = true
      setError('Помилка збереження. Спробуйте ще раз.')
    } finally {
      if (!hasError) {
        await load()
        setEditingSku(null)
      }
      setIsSyncing(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-3">
      {error && <div className="text-red-400 font-mono text-xs">{error}</div>}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-xl shadow-inner max-h-[420px] overflow-y-auto">
        {rows.length === 0 ? (
          <p className="p-4 text-xs font-mono text-white/30 uppercase">Немає даних</p>
        ) : (
          <div>
            <div className="sticky top-0 z-10 bg-[#0a0a0a] grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-2 p-3 border-b border-white/5 text-[10px] font-mono text-white/40 uppercase items-center">
              <span>Модель</span>
              <span className="text-center">Пусті</span>
              <span className="text-center">Спаковані</span>
              <span className="text-center">Склад</span>
              <span className="w-8"></span>
            </div>
            <div className="divide-y divide-white/5">
              {rows.map(row => {
                const mid = row.finished_main_min !== undefined && row.finished_main_max !== undefined
                  ? (row.finished_main_min + row.finished_main_max) / 2
                  : undefined
                const isCritical = row.finished_main_min !== undefined && row.finished_main < row.finished_main_min
                const isLow = !isCritical && mid !== undefined && row.finished_main < mid
                const rowBg = isCritical ? 'bg-red-900/20' : isLow ? 'bg-yellow-900/20' : ''
                const finishedMainColor = isCritical ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-[#c9963a]'
                return (
                <div key={row.sku} className={`grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-2 p-3 items-center hover:bg-white/5 transition-colors ${rowBg}`}>
                  <span className="text-sm font-mono text-white/80 break-words">{row.name}</span>
                  {editingSku === row.sku ? (
                    <>
                      <input type="number" value={editValues.cases_empty || ''} onChange={e => setEditValues(p => ({ ...p, cases_empty: e.target.value }))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1.5 text-center text-white font-mono text-xs outline-none" />
                      <input type="number" value={editValues.ready || ''} onChange={e => setEditValues(p => ({ ...p, ready: e.target.value }))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1.5 text-center text-white font-mono text-xs outline-none" />
                      <input type="number" value={editValues.finished_main || ''} onChange={e => setEditValues(p => ({ ...p, finished_main: e.target.value }))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1.5 text-center text-white font-mono text-xs outline-none" />
                      <div className="flex items-center gap-1">
                        <button onClick={() => saveEdit(row)} disabled={isSyncing} className="p-1.5 bg-green-900/30 text-green-500 rounded hover:bg-green-900/50">{isSyncing ? <Spinner /> : <Check className="w-3.5 h-3.5" />}</button>
                        <button onClick={cancelEdit} disabled={isSyncing} className="p-1.5 bg-red-900/30 text-red-500 rounded hover:bg-red-900/50"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-[#c9963a] font-mono text-sm text-center">{row.cases_empty}</span>
                      <span className="text-[#c9963a] font-mono text-sm text-center">{row.ready}</span>
                      <span className={`font-mono text-sm text-center ${finishedMainColor}`}>{row.finished_main}</span>
                      <button onClick={() => startEdit(row)} className="p-1.5 text-white/30 hover:text-[#c9963a] transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
