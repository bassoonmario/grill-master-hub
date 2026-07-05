import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { api, MasterDashboard, MasterLog, Shipment, Defect, ReplenishAlert, MasterWholesaleItem } from '@/lib/api'
import { SectionTitle, StatCard, Spinner, Card, Tabs } from '@/components/UI'
import { ShipmentsLog } from '@/components/ShipmentsLog'
import { Plus, Minus, Trash2, Pencil, Check, ChevronDown, ChevronUp, RefreshCw, Ruler, Truck, ShieldCheck, Wine, Target, DollarSign, AlertTriangle, PackagePlus } from 'lucide-react'

interface UnifiedStock {
  sku: string
  name: string
  ready: number
  cases: number
  warehouse_qty: number
  category: string
}

const CATEGORIES = [
  { id: 'standard', title: 'СТАНДАРТНІ ГРИЛІ', color: '#D4AF37', icon: Ruler },
  { id: 'large', title: 'ВЕЛИКІ ГРИЛІ', color: '#D4AF37', icon: Truck },
  { id: 'premium', title: 'ПРЕМІУМ СЕРІЯ', color: '#D4AF37', icon: ShieldCheck },
  { id: 'minibars', title: 'МІНІ-БАРИ', color: '#D4AF37', icon: Wine },
]

export function MasterCabinet() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'plan'

  const [data, setData] = useState<MasterDashboard | null>(null)
  const [logs, setLogs] = useState<MasterLog[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [wholesaleItems, setWholesaleItems] = useState<MasterWholesaleItem[]>([])
  const [shipmentsSubTab, setShipmentsSubTab] = useState<'log' | 'wholesale'>('log')
  const [defects, setDefects] = useState<Defect[]>([])
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [availableItems, setAvailableItems] = useState<string[]>([])
  const [newItem, setNewItem] = useState({ case_sku: '', quantity: 10 })

  const [editingLog, setEditingLog] = useState<MasterLog | null>(null)
  const [newQuantity, setNewQuantity] = useState<number>(0)
  const [localFacts, setLocalFacts] = useState<Record<number, string>>({})

  const [unifiedItems, setUnifiedItems] = useState<UnifiedStock[]>([])

  // Стейт для акордеону балансу складу
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const [replenishAlerts, setReplenishAlerts] = useState<ReplenishAlert[]>([])
  const [replenishLoading, setReplenishLoading] = useState<Record<number, boolean>>({})

  const parseCategory = (sku: string): string => {
    if (sku.startsWith('MB') || sku.startsWith('MBA')) return 'minibars'
    if (sku.startsWith('G')) {
      const numMatch = sku.match(/\d+/)
      if (numMatch) {
        const num = parseInt(numMatch[0])
        if ([21, 22, 24, 26].includes(num)) return 'premium'
        if (num >= 15 && num <= 18) return 'large'
        if ((num >= 1 && num <= 12) || num === 20) return 'standard'
      }
    }
    return 'other'
  }

  // Повне відновлення завантаження ВСІХ даних без втрат
  const loadData = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const [d, l, items, s, df, stock, alerts, wholesale] = await Promise.all([
        api.getMasterDashboard(user.name),
        api.getMasterLogs(user.name),
        api.getItems(),
        api.getShipments(),
        api.getDefects(),
        api.stock(),
        user.can_replenish ? api.getReplenishAlerts() : Promise.resolve([]),
        api.getMasterWholesale(),
      ])
      setData(d)
      setLogs(l)
      setAvailableItems(items)
      // extras з PostgreSQL JSONB може прийти як рядок — парсимо
      const parsedShipments = s.map(item => ({
        ...item,
        extras: typeof item.extras === 'string'
          ? JSON.parse(item.extras)
          : (item.extras ?? {})
      }))
      setShipments(parsedShipments)
      setDefects(df)
      setReplenishAlerts(alerts)
      setWholesaleItems(wholesale)

      const filtered = stock.filter(i =>
        i.category === 'ready' ||
        i.category === 'cases_empty' ||
        i.category === 'finished_main'
      )
      const grouped = filtered.reduce((acc, item) => {
        const cleanSku = item.sku.trim()
        if (!acc[cleanSku]) {
          acc[cleanSku] = {
            sku: cleanSku,
            name: item.name,
            ready: 0,
            cases: 0,
            warehouse_qty: 0,
            category: parseCategory(cleanSku)
          }
        }
        if (item.category === 'ready') acc[cleanSku].ready = item.qty
        if (item.category === 'cases_empty') acc[cleanSku].cases = item.qty
        if (item.category === 'finished_main') acc[cleanSku].warehouse_qty = item.qty
        return acc
      }, {} as Record<string, UnifiedStock>)

      setUnifiedItems(Object.values(grouped))

      const initialFacts: Record<number, string> = {}
      d.tasks.forEach(t => {
        initialFacts[t.id] = String(t.completed)
      })
      setLocalFacts(initialFacts)

    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading) {
      loadData()
    }
  }, [user, authLoading, loadData])

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleLogWork = async (taskId: number, itemCode: string, newTotal: number, currentCompleted: number) => {
    if (!user) return
    const diff = newTotal - currentCompleted
    if (diff === 0) return

    setIsSyncing(true)
    try {
      await api.logWork(user.name, itemCode, diff)
      await loadData()
    } catch (err) {
      alert('Помилка збереження')
      setLocalFacts(prev => ({ ...prev, [taskId]: String(currentCompleted) }))
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Видалити це завдання з плану?')) return
    try {
      await api.deleteMasterTask(taskId)
      await loadData()
    } catch { }
  }

  const handleInputChange = (taskId: number, val: string) => {
    setLocalFacts(prev => ({ ...prev, [taskId]: val }))
  }

  const handleQuickAdjust = (taskId: number, itemCode: string, currentCompleted: number, delta: number) => {
    const newVal = currentCompleted + delta
    handleLogWork(taskId, itemCode, newVal, currentCompleted)
  }

  const handleAddTask = async () => {
    if (!user || !newItem.case_sku) return
    setIsSyncing(true)
    try {
      await api.createMasterTask(user.name, newItem.case_sku, newItem.quantity)
      setIsAdding(false)
      await loadData()
    } finally {
      setIsSyncing(false)
    }
  }

  const handleUpdateLog = async () => {
    if (!editingLog) return
    setIsSyncing(true)
    try {
      await api.updateMasterLog(editingLog.id, newQuantity)
      setEditingLog(null)
      await loadData()
    } catch (err) {
      alert('Помилка оновлення логу')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDeleteLog = async (logId: number) => {
    if (!confirm("Дійсно видалити цей запис з історії? Склади та плани автоматично перерахуються!")) return
    setIsSyncing(true)
    try {
      await api.deleteMasterLog(logId)
      await loadData()
    } catch (err) {
      alert('Помилка видалення логу')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleConfirmReplenish = async (alertId: number) => {
    setReplenishLoading(prev => ({ ...prev, [alertId]: true }))
    try {
      await api.confirmReplenish(alertId)
      setReplenishAlerts(prev => prev.filter(a => a.id !== alertId))
    } catch {
      alert('Помилка підтвердження поповнення')
    } finally {
      setReplenishLoading(prev => ({ ...prev, [alertId]: false }))
    }
  }

  if (loading && !data) return <Spinner />

  return (
    <div className="px-1 pt-3 w-full">

        {tab === 'plan' && (
          <>
            <div className="flex justify-end mb-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="p-3 bg-white/5 border border-white/10 text-white rounded-xl active:scale-95 transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--orange)]' : ''}`} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <StatCard icon={<Target className="w-6 h-6" />} value={data?.potential_earnings || 0} label="План, грн" accent="orange" />
              <StatCard icon={<DollarSign className="w-6 h-6" />} value={data?.current_earnings || 0} label="Виконано, грн" accent="green" />
            </div>
          </>
        )}

        {/* СЕКЦІЯ ПОПОВНЕННЯ (тільки для can_replenish) */}
        {tab === 'plan' && user?.can_replenish && replenishAlerts.length > 0 && (
          <div className="mb-6 space-y-3">
            <SectionTitle>Поповнення майстерні</SectionTitle>
            {replenishAlerts.map(alert => {
              const packs = alert.pcs_per_pack > 1
                ? Math.round(alert.quantity / alert.pcs_per_pack)
                : null
              const boxes = packs && alert.packs_per_box > 0
                ? Math.floor(packs / alert.packs_per_box)
                : null
              const remainingPacks = boxes && alert.packs_per_box > 0
                ? packs! % alert.packs_per_box
                : null

              return (
                <div
                  key={alert.id}
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2.5">
                      <PackagePlus size={14} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
                      <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                        {alert.item_name}
                      </span>
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: 'var(--text-dim)' }}>
                      #{alert.id}
                    </span>
                  </div>

                  {/* Info rows */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
                        Зараз в майстерні
                      </span>
                      <span className="font-mono text-[12px]" style={{ color: 'var(--text-dim)' }}>
                        {alert.current_qty} шт
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
                        Забрати зі складу
                      </span>
                      <div className="text-right">
                        {packs ? (
                          <>
                            <span className="font-display text-base" style={{ color: 'var(--orange)' }}>
                              {boxes && boxes > 0 ? (
                                <>
                                  {boxes} ящ{boxes === 1 ? '' : 'ики'}
                                  {remainingPacks ? ` + ${remainingPacks} пач` : ''}
                                </>
                              ) : (
                                <>{packs} пач{packs === 1 ? 'ка' : 'ки'}</>
                              )}
                            </span>
                            <span className="font-mono text-[10px] ml-1.5" style={{ color: 'var(--text-dim)' }}>
                              ({alert.quantity} шт)
                            </span>
                          </>
                        ) : (
                          <span className="font-display text-base" style={{ color: 'var(--orange)' }}>
                            {alert.quantity} шт
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Button */}
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => handleConfirmReplenish(alert.id)}
                      disabled={!!replenishLoading[alert.id]}
                      className="w-full flex items-center justify-center gap-2 font-mono text-[11px] tracking-[2px] uppercase py-2.5 rounded-lg border transition-all active:scale-[0.98] disabled:opacity-50"
                      style={{ borderColor: 'var(--green)', color: 'var(--green)', background: 'var(--green-dim)' }}
                    >
                      {replenishLoading[alert.id]
                        ? <RefreshCw size={12} className="animate-spin" />
                        : <Check size={12} strokeWidth={2.5} />
                      }
                      {replenishLoading[alert.id] ? 'Збереження...' : 'Підтвердити поповнення'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ВКЛАДКА 1: АКТИВНІ ЗАВДАННЯ */}
        {tab === 'plan' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <SectionTitle>Активні завдання</SectionTitle>
              <button
                onClick={() => setIsAdding(true)}
                className="bg-white/5 border border-white/10 text-[var(--orange)] px-3 py-1 rounded-lg text-xs font-mono tracking-tighter flex items-center gap-1 active:scale-95 transition-all"
              >
                <Plus className="w-3 h-3" /> Додати
              </button>
            </div>

            {isAdding && (
              <Card className="border-2 border-[var(--orange)] shadow-[0_0_20px_rgba(255,140,66,0.2)]">
                <div className="p-4 bg-[#1a1a1a]">
                  <h4 className="text-white text-sm font-bold uppercase mb-4 flex items-center gap-2">
                    <Plus className="text-[var(--orange)] w-4 h-4" /> Нове завдання
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-gray-500 uppercase font-mono mb-1">Артикул моделі</label>
                      <select
                        value={newItem.case_sku}
                        onChange={(e) => setNewItem({ ...newItem, case_sku: e.target.value })}
                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm outline-none focus:border-[var(--orange)]"
                      >
                        <option value="">Оберіть артикул...</option>
                        {availableItems.map(item => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 uppercase font-mono mb-1">Планова кількість (шт)</label>
                      <input
                        type="number"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-center font-display text-xl outline-none focus:border-[var(--orange)]"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setIsAdding(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-xs font-bold uppercase">Скасувати</button>
                      <button onClick={handleAddTask} disabled={!newItem.case_sku || isSyncing} className="flex-[2] py-3 rounded-xl bg-[var(--orange)] text-black text-xs font-black uppercase shadow-lg disabled:opacity-30 transition-all flex items-center justify-center gap-2">
                        {isSyncing ? <Spinner /> : <Plus className="w-4 h-4" />} Додати
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {data?.tasks.map(task => (
              <Card key={task.id} className={`group relative transition-all border-l-4 ${task.is_priority ? 'border-l-[var(--orange)]' : 'border-l-transparent'} bg-[#121212]`}>
                <div className="p-4">
                  <div className="mb-4">
                    <h3 className="text-white font-medium text-lg leading-tight uppercase tracking-tight">{task.case_sku}</h3>
                    <span className="font-mono text-[11px] text-[var(--text-dim)]">План: {task.quantity} шт</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <button onClick={() => handleQuickAdjust(task.id, task.case_sku, task.completed, -1)} disabled={isSyncing || task.completed <= 0} className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl active:bg-red-500/20 disabled:opacity-20"><Minus className="w-5 h-5 text-red-500" /></button>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={localFacts[task.id] ?? ''}
                        onChange={(e) => handleInputChange(task.id, e.target.value)}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          if (isNaN(val)) return;
                          const diff = val < 0 ? val : (val - task.completed);
                          if (diff !== 0) handleLogWork(task.id, task.case_sku, task.completed + diff, task.completed);
                        }}
                        className="w-full h-12 bg-black/60 border border-white/10 rounded-xl text-center text-xl font-display text-white focus:border-[var(--orange)] outline-none transition-all"
                      />
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#D4AF37] text-black text-[8px] font-bold px-1.5 rounded uppercase tracking-tighter">Факт</div>
                    </div>
                    <button onClick={() => handleQuickAdjust(task.id, task.case_sku, task.completed, 1)} disabled={isSyncing} className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl active:bg-green-500/20 disabled:opacity-20"><Plus className="w-5 h-5 text-green-500" /></button>
                    <button onClick={() => handleDeleteTask(task.id)} className="w-10 h-10 flex items-center justify-center text-gray-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>

                  <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full transition-all duration-500 bg-gradient-to-r from-[var(--orange)] to-yellow-500" style={{ width: `${Math.min(100, (task.completed / task.quantity) * 100)}%` }} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ВКЛАДКА 2: ІСТОРІЯ ВИКОНАНИХ РОБІТ */}
        {tab === 'stats' && (
          <div className="space-y-3">
            <SectionTitle>Історія виконаних робіт</SectionTitle>
            {logs.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)] font-mono text-center py-8">Записів не знайдено</p>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex justify-between items-center bg-white/5 border border-white/10 backdrop-blur-sm p-4 rounded-xl hover:border-[var(--orange)] transition-colors">
                  <div>
                    <p className="text-white text-sm font-medium uppercase tracking-tight">{log.item_code}</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">{log.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--orange)] font-mono font-bold mr-2">+{log.quantity} шт</span>
                    <button onClick={() => { setEditingLog(log); setNewQuantity(log.quantity); }} className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-[var(--orange)] hover:text-black transition-all"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteLog(log.id)} className="p-2 bg-white/5 text-gray-500 rounded-lg hover:bg-red-500/20 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ВКЛАДКА 3: ВІДПРАВКИ */}
        {tab === 'shipments' && (
          <div className="space-y-3">
            <Tabs
              tabs={[
                { key: 'log', label: 'Відправки' },
                { key: 'wholesale', label: 'Опт' },
              ]}
              active={shipmentsSubTab}
              onChange={k => setShipmentsSubTab(k as 'log' | 'wholesale')}
              variant="underline"
            />

            {shipmentsSubTab === 'log' && (
              <ShipmentsLog shipments={shipments} />
            )}

            {shipmentsSubTab === 'wholesale' && (
              <div className="space-y-3">
                <SectionTitle>Опт — що зробити</SectionTitle>
                {wholesaleItems.length === 0 ? (
                  <p className="text-xs text-[var(--text-dim)] font-mono text-center py-8">Активних оптових позицій немає</p>
                ) : (
                  <ul className="space-y-[3px]">
                    {wholesaleItems.map((item, idx) => (
                      <li key={idx} className="flex items-baseline gap-1.5 font-mono text-[13px] bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                        <span className="text-white font-medium">{item.article}</span>
                        <span className="text-white/40">—</span>
                        <span className="text-[#4ade80] font-bold">{item.qty}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА 4: ОБЛІК БРАКУ */}
        {tab === 'defects' && (
          <div className="space-y-3">
            <SectionTitle>Облік бракованих деталей</SectionTitle>
            {defects.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)] font-mono text-center py-8">Записів про брак не знайдено</p>
            ) : (
              defects.map(d => (
                <div key={d.id} className="bg-white/5 border border-white/10 backdrop-blur-sm p-4 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold uppercase tracking-tight">{d.sku}</span>
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase ${d.status === 'fixed' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{d.status === 'fixed' ? 'Виправлено' : 'Брак'}</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-2">{d.reason}</p>
                  <p className="text-[10px] text-gray-500 font-mono mt-1">{new Date(d.defect_date).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* ВКЛАДКА 5: БАЛАНС СКЛАДІВ */}
        {tab === 'balance' && (
          <div className="space-y-4">
            {CATEGORIES.map(cat => {
              const catItems = unifiedItems.filter(i => i.category === cat.id)
              const isOpen = !!openGroups[cat.id]
              return (
                <div key={cat.id} className="border border-white/5 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-md">
                  <button onClick={() => toggleGroup(cat.id)} className="w-full p-4 flex items-center justify-between bg-white/[0.02] active:bg-white/[0.05] transition-colors">
                    <div className="flex flex-col items-start">
                      <span className="font-display text-lg tracking-wide flex items-center gap-2" style={{ color: cat.color }}>
                        <cat.icon className="w-5 h-5" />
                        {cat.title}
                      </span>
                      <span className="text-[10px] text-white/40 uppercase font-mono">Позицій: {catItems.length}</span>
                    </div>
                    {isOpen ? <ChevronUp className="text-white/20" /> : <ChevronDown className="text-white/20" />}
                  </button>
                  {isOpen && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      {catItems.length === 0 ? (
                        <div className="text-center py-6 text-white/20 text-sm italic">Немає даних</div>
                      ) : (
                        <>
                          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2 p-3 bg-white/5 border-b border-white/5 text-[10px] font-mono text-white/40 uppercase items-center">
                            <span>Модель</span>
                            <span className="text-center">Кейси</span>
                            <span className="text-center">Готові</span>
                            <span className="text-center">Склад</span>
                          </div>
                          <div className="divide-y divide-white/5">
                            {catItems.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' })).map(item => (
                              <div key={item.sku} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2 p-3 items-center">
                                <span className="text-sm font-mono text-white/80 break-words pr-2">{item.name}</span>
                                <span className="text-center text-[#c9963a] font-mono text-sm">{item.cases}</span>
                                <span className="text-center text-[#c9963a] font-mono text-sm">{item.ready}</span>
                                <span className="text-center text-[#c9963a] font-mono text-sm">{item.warehouse_qty}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {editingLog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <Card className="w-full max-w-sm border border-white/10 shadow-2xl">
            <div className="p-6 bg-[#121212]">
              <h3 className="text-white font-bold uppercase text-sm tracking-wide mb-4 flex items-center gap-2">
                <AlertTriangle className="text-[var(--orange)] w-4 h-4" /> Редагувати лог
              </h3>
              <p className="text-xs text-[var(--text-dim)] font-mono mb-4 uppercase">{editingLog.item_code}</p>
              <input
                type="number"
                value={newQuantity}
                onChange={(e) => setNewQuantity(parseFloat(e.target.value) || 0)}
                className="w-full bg-black border border-white/10 rounded-xl p-3 text-white mb-6 text-2xl text-center font-display focus:border-[var(--orange)] outline-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setEditingLog(null)} className="flex-1 py-3 text-gray-400 text-xs font-mono uppercase tracking-wider rounded-xl border border-white/5 hover:bg-white/5">Скасувати</button>
                <button onClick={handleUpdateLog} disabled={isSyncing} className="flex-1 py-3 bg-[var(--orange)] text-black font-black text-xs font-mono uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10">
                  <Check className="w-4 h-4" /> Зберегти
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
