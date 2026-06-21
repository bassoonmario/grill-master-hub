import { useState, useEffect, useCallback } from 'react'
import { SectionTitle, Spinner } from '@/components/UI'
import { api, StockItem } from '@/lib/api'
import { ChevronDown, ChevronUp, Pencil, Check, X, AlertCircle } from 'lucide-react'

interface GrillRow {
  sku: string
  name: string
  cases_empty: number
  ready: number
  finished_main: number
}

interface WarehouseRow {
  sku: string
  name: string
  operative: number
  main: number
}

interface ComponentRow {
  id: number
  sku: string
  name: string
  qty: number
}

export function AdminWarehouses() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openAccordion, setOpenAccordion] = useState<string | null>(null)
  
  const [editingSku, setEditingSku] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [isSyncing, setIsSyncing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.stock()
      setItems(data || [])
    } catch (e) {
      console.error(e)
      setError("Помилка завантаження складу")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleAccordion = (key: string) => {
    setOpenAccordion(openAccordion === key ? null : key)
  }

  const startEditGrill = (row: GrillRow) => {
    setEditingSku(row.sku)
    setEditValues({
      cases_empty: String(row.cases_empty),
      ready: String(row.ready),
      finished_main: String(row.finished_main)
    })
    setError(null)
  }

  const startEditWarehouse = (row: WarehouseRow) => {
    setEditingSku(row.sku)
    setEditValues({
      operative: String(row.operative),
      main: String(row.main)
    })
    setError(null)
  }

  const startEditComponent = (row: ComponentRow) => {
    setEditingSku(row.sku)
    setEditValues({
      components: String(row.qty)
    })
    setError(null)
  }

  const cancelEdit = () => {
    setEditingSku(null)
    setEditValues({})
  }

  const saveEditGrill = async (row: GrillRow) => {
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
      console.error(e)
      hasError = true
      setError("Помилка збереження. Спробуйте ще раз.")
    } finally {
      if (!hasError) {
        await loadData()
        setEditingSku(null)
      }
      setIsSyncing(false)
    }
  }

  const saveEditWarehouse = async (row: WarehouseRow) => {
    setIsSyncing(true)
    setError(null)
    let hasError = false
    try {
      const vOp = parseInt(editValues.operative)
      const vMain = parseInt(editValues.main)

      if (!isNaN(vOp) && vOp >= 0 && vOp !== row.operative) await api.updateInventory('operative', row.sku, vOp)
      if (!isNaN(vMain) && vMain >= 0 && vMain !== row.main) await api.updateInventory('main', row.sku, vMain)
    } catch (e) {
      console.error(e)
      hasError = true
      setError("Помилка збереження. Спробуйте ще раз.")
    } finally {
      if (!hasError) {
        await loadData()
        setEditingSku(null)
      }
      setIsSyncing(false)
    }
  }

  const saveEditComponent = async (row: ComponentRow) => {
    setIsSyncing(true)
    setError(null)
    let hasError = false
    try {
      const vComp = parseInt(editValues.components)
      if (!isNaN(vComp) && vComp >= 0 && vComp !== row.qty) await api.updateInventory('components', row.sku, vComp)
    } catch (e) {
      console.error(e)
      hasError = true
      setError("Помилка збереження. Спробуйте ще раз.")
    } finally {
      if (!hasError) {
        await loadData()
        setEditingSku(null)
      }
      setIsSyncing(false)
    }
  }

  // Grouping logic
  const grillsMap = new Map<string, GrillRow>()
  const warehousesMap = new Map<string, WarehouseRow>()
  const componentsMap = new Map<string, ComponentRow>()

  const safeItems = items || []
  safeItems.forEach(i => {
    if (!i) return
    if (['cases_empty', 'ready', 'finished_main'].includes(i.category)) {
      if (!grillsMap.has(i.sku)) grillsMap.set(i.sku, { sku: i.sku, name: i.name || i.sku, cases_empty: 0, ready: 0, finished_main: 0 })
      const entry = grillsMap.get(i.sku)!
      if (i.category === 'cases_empty') entry.cases_empty = i.qty
      if (i.category === 'ready') entry.ready = i.qty
      if (i.category === 'finished_main') entry.finished_main = i.qty
    } else if (['operative', 'main'].includes(i.category)) {
      if (!warehousesMap.has(i.sku)) warehousesMap.set(i.sku, { sku: i.sku, name: i.name || i.sku, operative: 0, main: 0 })
      const entry = warehousesMap.get(i.sku)!
      if (i.category === 'operative') entry.operative = i.qty
      if (i.category === 'main') entry.main = i.qty
    } else if (i.category === 'cases') {
      componentsMap.set(i.sku, { id: i.id, sku: i.sku, name: i.name || i.sku, qty: i.qty })
    }
  })

  const grills = Array.from(grillsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  const warehouses = Array.from(warehousesMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  const componentsList = Array.from(componentsMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-6 pb-20">
      <SectionTitle>Моніторинг Складів</SectionTitle>

      {error && (
        <div className="bg-red-950/50 border border-red-900/50 text-red-200 p-4 rounded-xl flex items-center gap-3 text-sm font-mono shadow-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Грилі */}
          <div>
            <button 
              onClick={() => toggleAccordion('grills')}
              className="w-full flex justify-between items-center bg-[#121212] border border-white/10 p-4 rounded-xl text-left hover:bg-[#1a1a1a] transition-colors"
            >
              <span className="text-white font-display text-lg uppercase tracking-wider">Грилі</span>
              {openAccordion === 'grills' ? <ChevronUp className="w-5 h-5 text-[#c9963a]" /> : <ChevronDown className="w-5 h-5 text-[#c9963a]" />}
            </button>
            {openAccordion === 'grills' && (
              <div className="mt-2 bg-[#0a0a0a] border border-white/5 rounded-xl overflow-hidden shadow-inner">
                {grills.length === 0 ? (
                  <p className="p-4 text-xs font-mono text-[var(--text-dim)] uppercase">Немає даних</p>
                ) : (
                  <div>
                    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-2 p-3 bg-white/5 border-b border-white/5 text-[10px] font-mono text-white/40 uppercase items-center">
                      <span>Модель</span>
                      <span className="text-center">Пусті</span>
                      <span className="text-center">Спаковані</span>
                      <span className="text-center">Склад</span>
                      <span className="w-8"></span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {grills.map(row => (
                        <div key={row.sku} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-2 p-3 items-center hover:bg-white/5 transition-colors group">
                          <span className="text-sm font-mono text-white/80 break-words pr-2">{row.name}</span>
                          
                          {editingSku === row.sku ? (
                            <>
                              <input type="number" value={editValues.cases_empty || ''} onChange={e => setEditValues(p => ({...p, cases_empty: e.target.value}))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1.5 text-center text-white font-mono text-xs outline-none" />
                              <input type="number" value={editValues.ready || ''} onChange={e => setEditValues(p => ({...p, ready: e.target.value}))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1.5 text-center text-white font-mono text-xs outline-none" />
                              <input type="number" value={editValues.finished_main || ''} onChange={e => setEditValues(p => ({...p, finished_main: e.target.value}))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1.5 text-center text-white font-mono text-xs outline-none" />
                              <div className="flex items-center gap-1">
                                <button onClick={() => saveEditGrill(row)} disabled={isSyncing} className="p-1.5 bg-green-900/30 text-green-500 rounded hover:bg-green-900/50">{isSyncing ? <Spinner /> : <Check className="w-3.5 h-3.5" />}</button>
                                <button onClick={cancelEdit} disabled={isSyncing} className="p-1.5 bg-red-900/30 text-red-500 rounded hover:bg-red-900/50"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="text-center text-[#c9963a] font-mono text-sm">{row.cases_empty}</span>
                              <span className="text-center text-[#c9963a] font-mono text-sm">{row.ready}</span>
                              <span className="text-center text-[#c9963a] font-mono text-sm">{row.finished_main}</span>
                              <button onClick={() => startEditGrill(row)} className="p-1.5 text-white/30 hover:text-[#c9963a] transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Склади */}
          <div>
            <button 
              onClick={() => toggleAccordion('warehouses')}
              className="w-full flex justify-between items-center bg-[#121212] border border-white/10 p-4 rounded-xl text-left hover:bg-[#1a1a1a] transition-colors"
            >
              <span className="text-white font-display text-lg uppercase tracking-wider">Склади</span>
              {openAccordion === 'warehouses' ? <ChevronUp className="w-5 h-5 text-[#c9963a]" /> : <ChevronDown className="w-5 h-5 text-[#c9963a]" />}
            </button>
            {openAccordion === 'warehouses' && (
              <div className="mt-2 bg-[#0a0a0a] border border-white/5 rounded-xl overflow-hidden shadow-inner">
                {warehouses.length === 0 ? (
                  <p className="p-4 text-xs font-mono text-[var(--text-dim)] uppercase">Немає даних</p>
                ) : (
                  <div>
                    <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 p-3 bg-white/5 border-b border-white/5 text-[10px] font-mono text-white/40 uppercase items-center">
                      <span>Назва</span>
                      <span className="text-center">Оперативний</span>
                      <span className="text-center">Основний</span>
                      <span className="w-8"></span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {warehouses.map(row => (
                        <div key={row.sku} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 p-3 items-center hover:bg-white/5 transition-colors">
                          <span className="text-sm font-mono text-white/80 break-words pr-2">{row.name}</span>
                          
                          {editingSku === row.sku ? (
                            <>
                              <input type="number" value={editValues.operative || ''} onChange={e => setEditValues(p => ({...p, operative: e.target.value}))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1.5 text-center text-white font-mono text-xs outline-none" />
                              <input type="number" value={editValues.main || ''} onChange={e => setEditValues(p => ({...p, main: e.target.value}))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1.5 text-center text-white font-mono text-xs outline-none" />
                              <div className="flex items-center gap-1">
                                <button onClick={() => saveEditWarehouse(row)} disabled={isSyncing} className="p-1.5 bg-green-900/30 text-green-500 rounded hover:bg-green-900/50">{isSyncing ? <Spinner /> : <Check className="w-3.5 h-3.5" />}</button>
                                <button onClick={cancelEdit} disabled={isSyncing} className="p-1.5 bg-red-900/30 text-red-500 rounded hover:bg-red-900/50"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="text-center text-[#c9963a] font-mono text-sm">{row.operative}</span>
                              <span className="text-center text-[#c9963a] font-mono text-sm">{row.main}</span>
                              <button onClick={() => startEditWarehouse(row)} className="p-1.5 text-white/30 hover:text-[#c9963a] transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Кейс-компоненти */}
          <div>
            <button 
              onClick={() => toggleAccordion('components')}
              className="w-full flex justify-between items-center bg-[#121212] border border-white/10 p-4 rounded-xl text-left hover:bg-[#1a1a1a] transition-colors"
            >
              <span className="text-white font-display text-lg uppercase tracking-wider">Кейс-компоненти</span>
              {openAccordion === 'components' ? <ChevronUp className="w-5 h-5 text-[#c9963a]" /> : <ChevronDown className="w-5 h-5 text-[#c9963a]" />}
            </button>
            {openAccordion === 'components' && (
              <div className="mt-2 bg-[#0a0a0a] border border-white/5 rounded-xl overflow-hidden shadow-inner">
                {componentsList.length === 0 ? (
                  <p className="p-4 text-xs font-mono text-[var(--text-dim)] uppercase">Немає даних</p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {componentsList.map(row => (
                      <div key={row.sku} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <span className="text-sm font-mono text-white/80 pr-4">{row.name}</span>
                        
                        <div className="flex flex-shrink-0">
                          {editingSku === row.sku ? (
                            <div className="flex items-center gap-2">
                              <input type="number" value={editValues.components || ''} onChange={e => setEditValues(p => ({...p, components: e.target.value}))} disabled={isSyncing} className="w-16 bg-black border border-[#c9963a] rounded p-1.5 text-center text-white font-mono text-xs outline-none" />
                              <div className="flex items-center gap-1">
                                <button onClick={() => saveEditComponent(row)} disabled={isSyncing} className="p-1.5 bg-green-900/30 text-green-500 rounded hover:bg-green-900/50">{isSyncing ? <Spinner /> : <Check className="w-3.5 h-3.5" />}</button>
                                <button onClick={cancelEdit} disabled={isSyncing} className="p-1.5 bg-red-900/30 text-red-500 rounded hover:bg-red-900/50"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="text-[#c9963a] font-mono text-sm">{row.qty}</span>
                              <button onClick={() => startEditComponent(row)} className="p-1.5 text-white/30 hover:text-[#c9963a] transition-colors"><Pencil className="w-4 h-4" /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
