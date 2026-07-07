import { useState, useEffect, useCallback } from 'react'
import { SectionTitle, Spinner, Tabs } from '@/components/UI'
import { ReplenishModal, ReplenishItem } from '@/components/ReplenishModal'
import { InventoryCheckModal, CheckModalItem } from '@/components/InventoryCheckModal'
import { api, StockItem, LatestCheck } from '@/lib/api'
import { Pencil, Check, X, AlertCircle, PlusCircle, ClipboardCheck } from 'lucide-react'

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
  min_limit?: number
  max_limit?: number
}

interface ComponentRow {
  id: string
  sku: string
  name: string
  qty: number
  min_threshold: number
  unit_type: string
  conversion_factor: number
}

interface LootBoxRow {
  sku: string
  name: string
  operative: number
  main: number
  min_limit?: number
}

// table_key (as sent to /api/admin/inventory/check) -> StockItem.category (as returned by api.stock())
const TABLE_KEY_TO_CATEGORY: Record<string, StockItem['category']> = {
  cases_empty: 'cases_empty',
  finished: 'ready',
  finished_main: 'finished_main',
  operative: 'operative',
  main: 'main',
  components: 'cases',
  loot_box_operative: 'loot_box_operative',
  loot_box_main: 'loot_box_main',
}

export function AdminWarehouses() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'warehouses' | 'grills' | 'components' | 'loot_boxes'>('warehouses')

  const [editingSku, setEditingSku] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [isSyncing, setIsSyncing] = useState(false)
  const [replenishModal, setReplenishModal] = useState<ReplenishItem | null>(null)
  const [checkModal, setCheckModal] = useState<CheckModalItem | null>(null)
  const [checksMap, setChecksMap] = useState<Record<string, { delta: number; checked_at: string }>>({})
  const [checkLoadingKey, setCheckLoadingKey] = useState<string | null>(null)

  const openCheck = async (name: string, item_id: string, table_key: string, lastKnownQty: number) => {
    const key = `${table_key}:${item_id}`
    setCheckLoadingKey(key)
    try {
      const fresh = await api.stock()
      const category = TABLE_KEY_TO_CATEGORY[table_key]
      const match = fresh.find(i => i.sku === item_id && i.category === category)
      setCheckModal({ name, item_id, table_key, system_qty: match ? match.qty : lastKnownQty })
    } catch (e) {
      console.error(e)
      setCheckModal({ name, item_id, table_key, system_qty: lastKnownQty })
    } finally {
      setCheckLoadingKey(null)
    }
  }


  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [data, checks] = await Promise.all([
        api.stock(),
        api.getLatestChecks().catch((): LatestCheck[] => []),
      ])
      setItems(data || [])
      const map: Record<string, { delta: number; checked_at: string }> = {}
      for (const c of checks) {
        map[`${c.table_key}:${c.item_id}`] = { delta: c.delta, checked_at: c.checked_at }
      }
      setChecksMap(map)
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

  const startEditLootBox = (row: LootBoxRow) => {
    setEditingSku(row.sku)
    setEditValues({
      operative: String(row.operative),
      main: String(row.main)
    })
    setError(null)
  }

  const saveEditLootBox = async (row: LootBoxRow) => {
    setIsSyncing(true)
    setError(null)
    let hasError = false
    try {
      const vOp = parseInt(editValues.operative)
      const vMain = parseInt(editValues.main)

      if (!isNaN(vOp) && vOp >= 0 && vOp !== row.operative) await api.updateInventory('loot_box_operative', row.sku, vOp)
      if (!isNaN(vMain) && vMain >= 0 && vMain !== row.main) await api.updateInventory('loot_box_main', row.sku, vMain)
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

  // Grouping logic
  const grillsMap = new Map<string, GrillRow>()
  const warehousesMap = new Map<string, WarehouseRow>()
  const componentsMap = new Map<string, ComponentRow>()
  const lootBoxMap = new Map<string, LootBoxRow>()

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
      if (i.category === 'operative') {
        entry.operative = i.qty
        if (i.min_limit !== undefined) entry.min_limit = i.min_limit
      }
      if (i.category === 'main') entry.main = i.qty
    } else if (i.category === 'cases') {
      componentsMap.set(i.sku, {
        id: String(i.id),
        sku: i.sku,
        name: i.name || i.sku,
        qty: i.qty,
        min_threshold: i.min_limit || 0,
        unit_type: i.unit_type || 'pcs',
        conversion_factor: i.conversion_factor || 1,
      })
    } else if (['loot_box_operative', 'loot_box_main'].includes(i.category)) {
      if (!lootBoxMap.has(i.sku)) lootBoxMap.set(i.sku, { sku: i.sku, name: i.name || i.sku, operative: 0, main: 0 })
      const entry = lootBoxMap.get(i.sku)!
      if (i.category === 'loot_box_operative') {
        entry.operative = i.qty
        if (i.min_limit !== undefined) entry.min_limit = i.min_limit
      }
      if (i.category === 'loot_box_main') entry.main = i.qty
    }
  })

  const grills = Array.from(grillsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  const warehouses = Array.from(warehousesMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  const componentsList = Array.from(componentsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  const lootBoxList = Array.from(lootBoxMap.values()).sort((a, b) => a.name.localeCompare(b.name))

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

          <Tabs
            tabs={[
              { key: 'warehouses', label: 'Склади' },
              { key: 'grills', label: 'Грилі' },
              { key: 'components', label: 'Кейс-компоненти' },
              { key: 'loot_boxes', label: 'Ящики' },
            ]}
            active={activeTab}
            onChange={key => setActiveTab(key as typeof activeTab)}
            variant="underline"
          />

          {activeTab === 'grills' && (
            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl shadow-inner max-h-[420px] overflow-y-auto">
                {grills.length === 0 ? (
                  <p className="p-4 text-xs font-mono text-[var(--text-dim)] uppercase">Немає даних</p>
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
                      {grills.map(row => (
                        <div key={row.sku} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-2 p-3 items-center hover:bg-white/5 transition-colors group">
                          <div className="flex flex-col gap-0.5 pr-2">
                            <span className="text-sm font-mono text-white/80 break-words">{row.name}</span>
                            {(() => {
                              const chk = checksMap[`cases_empty:${row.sku}`]
                              if (!chk) return null
                              const d = chk.delta
                              return <span title="Накопичена розбіжність" className={`text-[10px] font-mono ${d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-white/40'}`}>{d > 0 ? `+${d} ↑` : d < 0 ? `${d} ↓` : '= без змін'}</span>
                            })()}
                          </div>

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
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-0.5">
                                  <span className="text-[#c9963a] font-mono text-sm">{row.cases_empty}</span>
                                  <button onClick={() => openCheck(row.name, row.sku, 'cases_empty', row.cases_empty)} disabled={checkLoadingKey === `cases_empty:${row.sku}`} className="p-1.5 text-white/30 hover:text-blue-400 transition-colors disabled:opacity-40">{checkLoadingKey === `cases_empty:${row.sku}` ? <Spinner /> : <ClipboardCheck className="w-3.5 h-3.5" />}</button>
                                </div>
                              </div>
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-0.5">
                                  <span className="text-[#c9963a] font-mono text-sm">{row.ready}</span>
                                  <button onClick={() => openCheck(row.name, row.sku, 'finished', row.ready)} disabled={checkLoadingKey === `finished:${row.sku}`} className="p-1.5 text-white/30 hover:text-blue-400 transition-colors disabled:opacity-40">{checkLoadingKey === `finished:${row.sku}` ? <Spinner /> : <ClipboardCheck className="w-3.5 h-3.5" />}</button>
                                </div>
                                {(() => { const chk = checksMap[`finished:${row.sku}`]; if (!chk) return null; const d = chk.delta; return <span title="Накопичена розбіжність" className={`text-[10px] font-mono ${d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-white/40'}`}>{d > 0 ? `+${d} ↑` : d < 0 ? `${d} ↓` : '= без змін'}</span> })()}
                              </div>
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-0.5">
                                  <span className="text-[#c9963a] font-mono text-sm">{row.finished_main}</span>
                                  <button onClick={() => openCheck(row.name, row.sku, 'finished_main', row.finished_main)} disabled={checkLoadingKey === `finished_main:${row.sku}`} className="p-1.5 text-white/30 hover:text-blue-400 transition-colors disabled:opacity-40">{checkLoadingKey === `finished_main:${row.sku}` ? <Spinner /> : <ClipboardCheck className="w-3.5 h-3.5" />}</button>
                                </div>
                                {(() => { const chk = checksMap[`finished_main:${row.sku}`]; if (!chk) return null; const d = chk.delta; return <span title="Накопичена розбіжність" className={`text-[10px] font-mono ${d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-white/40'}`}>{d > 0 ? `+${d} ↑` : d < 0 ? `${d} ↓` : '= без змін'}</span> })()}
                              </div>
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => startEditGrill(row)} className="p-1.5 text-white/30 hover:text-[#c9963a] transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          {activeTab === 'warehouses' && (
            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl shadow-inner max-h-[420px] overflow-y-auto">
                {warehouses.length === 0 ? (
                  <p className="p-4 text-xs font-mono text-[var(--text-dim)] uppercase">Немає даних</p>
                ) : (
                  <div>
                    <div className="sticky top-0 z-10 bg-[#0a0a0a] grid grid-cols-[2fr_0.8fr_0.8fr_auto] gap-1.5 px-2.5 py-2 border-b border-white/5 text-[9px] font-mono text-white/40 uppercase items-center">
                      <span>Назва</span>
                      <span className="text-center">Операт.</span>
                      <span className="text-center">Основний</span>
                      <span className="w-7"></span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {warehouses.map(row => {
                        const mid = row.min_limit !== undefined && row.max_limit !== undefined
                          ? (row.min_limit + row.max_limit) / 2
                          : undefined
                        const isCritical = row.min_limit !== undefined && row.operative < row.min_limit
                        const isLow = !isCritical && mid !== undefined && row.operative < mid
                        const rowBg = isCritical ? 'bg-red-900/20' : isLow ? 'bg-yellow-900/20' : ''
                        const opColor = isCritical ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-[#c9963a]'
                        return (
                          <div key={row.sku} className={`grid grid-cols-[2fr_0.8fr_0.8fr_auto] gap-1.5 px-2.5 py-2 items-center hover:bg-white/5 transition-colors ${rowBg}`}>
                            <div className="flex flex-col gap-0.5 pr-1">
                              <span className="text-xs font-mono text-white/80 break-words">{row.name}</span>
                              {(() => {
                                const chk = checksMap[`operative:${row.sku}`]
                                if (!chk) return null
                                const d = chk.delta
                                return <span title="Накопичена розбіжність" className={`text-[10px] font-mono ${d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-white/40'}`}>{d > 0 ? `+${d} ↑` : d < 0 ? `${d} ↓` : '= без змін'}</span>
                              })()}
                            </div>

                            {editingSku === row.sku
                              ? <input type="number" value={editValues.operative || ''} onChange={e => setEditValues(p => ({...p, operative: e.target.value}))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1 text-center text-white font-mono text-xs outline-none" />
                              : <div className="flex items-center justify-center gap-0.5">
                                  <span className={`font-mono text-xs ${opColor}`}>{row.operative}</span>
                                  <button onClick={() => openCheck(row.name, row.sku, 'operative', row.operative)} disabled={checkLoadingKey === `operative:${row.sku}`} className="p-1 text-white/30 hover:text-blue-400 transition-colors disabled:opacity-40">{checkLoadingKey === `operative:${row.sku}` ? <Spinner /> : <ClipboardCheck className="w-3 h-3" />}</button>
                                </div>
                            }

                            {editingSku === row.sku
                              ? <input type="number" value={editValues.main || ''} onChange={e => setEditValues(p => ({...p, main: e.target.value}))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1 text-center text-white font-mono text-xs outline-none" />
                              : <div className="flex flex-col items-center gap-0.5">
                                  <div className="flex items-center gap-0.5">
                                    <span className="text-[#c9963a] font-mono text-xs">{row.main}</span>
                                    <button onClick={() => openCheck(row.name, row.sku, 'main', row.main)} disabled={checkLoadingKey === `main:${row.sku}`} className="p-1 text-white/30 hover:text-blue-400 transition-colors disabled:opacity-40">{checkLoadingKey === `main:${row.sku}` ? <Spinner /> : <ClipboardCheck className="w-3 h-3" />}</button>
                                  </div>
                                  {(() => { const chk = checksMap[`main:${row.sku}`]; if (!chk) return null; const d = chk.delta; return <span title="Накопичена розбіжність" className={`text-[10px] font-mono ${d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-white/40'}`}>{d > 0 ? `+${d} ↑` : d < 0 ? `${d} ↓` : '= без змін'}</span> })()}
                                </div>
                            }

                            {editingSku === row.sku ? (
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => saveEditWarehouse(row)} disabled={isSyncing} className="p-1 bg-green-900/30 text-green-500 rounded hover:bg-green-900/50">{isSyncing ? <Spinner /> : <Check className="w-3 h-3" />}</button>
                                <button onClick={cancelEdit} disabled={isSyncing} className="p-1 bg-red-900/30 text-red-500 rounded hover:bg-red-900/50"><X className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => startEditWarehouse(row)} className="p-1 text-white/30 hover:text-[#c9963a] transition-colors"><Pencil className="w-3 h-3" /></button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

          {activeTab === 'loot_boxes' && (
            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl shadow-inner max-h-[420px] overflow-y-auto">
                {lootBoxList.length === 0 ? (
                  <p className="p-4 text-xs font-mono text-[var(--text-dim)] uppercase">Немає даних</p>
                ) : (
                  <div>
                    <div className="sticky top-0 z-10 bg-[#0a0a0a] grid grid-cols-[2fr_0.8fr_0.8fr_auto] gap-1.5 px-2.5 py-2 border-b border-white/5 text-[9px] font-mono text-white/40 uppercase items-center">
                      <span>Назва</span>
                      <span className="text-center">Операт.</span>
                      <span className="text-center">Основний</span>
                      <span className="w-7"></span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {lootBoxList.map(row => {
                        const isCritical = row.min_limit !== undefined && row.operative < row.min_limit
                        const rowBg = isCritical ? 'bg-red-900/20' : ''
                        const opColor = isCritical ? 'text-red-400' : 'text-[#c9963a]'
                        return (
                          <div key={row.sku} className={`grid grid-cols-[2fr_0.8fr_0.8fr_auto] gap-1.5 px-2.5 py-2 items-center hover:bg-white/5 transition-colors ${rowBg}`}>
                            <div className="flex flex-col gap-0.5 pr-1">
                              <span className="text-xs font-mono text-white/80 break-words">{row.name}</span>
                              {(() => {
                                const chk = checksMap[`loot_box_operative:${row.sku}`]
                                if (!chk) return null
                                const d = chk.delta
                                return <span title="Накопичена розбіжність" className={`text-[10px] font-mono ${d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-white/40'}`}>{d > 0 ? `+${d} ↑` : d < 0 ? `${d} ↓` : '= без змін'}</span>
                              })()}
                            </div>

                            {editingSku === row.sku
                              ? <input type="number" value={editValues.operative || ''} onChange={e => setEditValues(p => ({...p, operative: e.target.value}))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1 text-center text-white font-mono text-xs outline-none" />
                              : <div className="flex items-center justify-center gap-0.5">
                                  <span className={`font-mono text-xs ${opColor}`}>{row.operative}</span>
                                  <button onClick={() => openCheck(row.name, row.sku, 'loot_box_operative', row.operative)} disabled={checkLoadingKey === `loot_box_operative:${row.sku}`} className="p-1.5 text-white/30 hover:text-blue-400 transition-colors disabled:opacity-40">{checkLoadingKey === `loot_box_operative:${row.sku}` ? <Spinner /> : <ClipboardCheck className="w-3 h-3" />}</button>
                                </div>
                            }

                            {editingSku === row.sku
                              ? <input type="number" value={editValues.main || ''} onChange={e => setEditValues(p => ({...p, main: e.target.value}))} disabled={isSyncing} className="w-full bg-black border border-[#c9963a] rounded p-1 text-center text-white font-mono text-xs outline-none" />
                              : <div className="flex flex-col items-center gap-0.5">
                                  <div className="flex items-center gap-0.5">
                                    <span className="text-[#c9963a] font-mono text-xs">{row.main}</span>
                                    <button onClick={() => openCheck(row.name, row.sku, 'loot_box_main', row.main)} disabled={checkLoadingKey === `loot_box_main:${row.sku}`} className="p-1.5 text-white/30 hover:text-blue-400 transition-colors disabled:opacity-40">{checkLoadingKey === `loot_box_main:${row.sku}` ? <Spinner /> : <ClipboardCheck className="w-3 h-3" />}</button>
                                  </div>
                                  {(() => { const chk = checksMap[`loot_box_main:${row.sku}`]; if (!chk) return null; const d = chk.delta; return <span title="Накопичена розбіжність" className={`text-[10px] font-mono ${d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-white/40'}`}>{d > 0 ? `+${d} ↑` : d < 0 ? `${d} ↓` : '= без змін'}</span> })()}
                                </div>
                            }

                            {editingSku === row.sku ? (
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => saveEditLootBox(row)} disabled={isSyncing} className="p-1 bg-green-900/30 text-green-500 rounded hover:bg-green-900/50">{isSyncing ? <Spinner /> : <Check className="w-3 h-3" />}</button>
                                <button onClick={cancelEdit} disabled={isSyncing} className="p-1 bg-red-900/30 text-red-500 rounded hover:bg-red-900/50"><X className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => startEditLootBox(row)} className="p-1 text-white/30 hover:text-[#c9963a] transition-colors"><Pencil className="w-3 h-3" /></button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

          {activeTab === 'components' && (
            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl shadow-inner max-h-[420px] overflow-y-auto">
                {componentsList.length === 0 ? (
                  <p className="p-4 text-xs font-mono text-[var(--text-dim)] uppercase">Немає даних</p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {componentsList.map(row => (
                      <div key={row.sku} className={`p-4 flex items-center justify-between hover:bg-white/5 transition-colors ${row.qty < row.min_threshold ? 'bg-red-900/10' : ''}`}>
                        <div className="flex flex-col gap-0.5 pr-4">
                          <span className="text-sm font-mono text-white/80">{row.name}</span>
                          {(() => {
                            const chk = checksMap[`components:${row.sku}`]
                            if (!chk) return null
                            const d = chk.delta
                            return <span title="Накопичена розбіжність" className={`text-[10px] font-mono ${d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-white/40'}`}>{d > 0 ? `+${d} ↑` : d < 0 ? `${d} ↓` : '= без змін'}</span>
                          })()}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[#c9963a] font-mono text-sm">
                            {row.unit_type === 'roll'
                              ? `${(row.qty / row.conversion_factor).toFixed(1)} м`
                              : row.unit_type === 'kg'
                              ? `${(row.qty / row.conversion_factor).toFixed(2)} кг`
                              : `${row.qty} шт`
                            }
                          </span>
                          <button onClick={() => openCheck(row.name, row.sku, 'components', row.qty)} disabled={checkLoadingKey === `components:${row.sku}`} className="p-1.5 text-white/30 hover:text-blue-400 transition-colors disabled:opacity-40">{checkLoadingKey === `components:${row.sku}` ? <Spinner /> : <ClipboardCheck className="w-4 h-4" />}</button>
                          <button onClick={() => setReplenishModal(row)} className="p-1.5 text-white/30 hover:text-green-400 transition-colors"><PlusCircle className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

        </div>
      )}

      <ReplenishModal
        item={replenishModal}
        onClose={() => setReplenishModal(null)}
        onSuccess={loadData}
      />
      <InventoryCheckModal
        item={checkModal}
        onClose={() => setCheckModal(null)}
        onSuccess={loadData}
      />
    </div>
  )
}
