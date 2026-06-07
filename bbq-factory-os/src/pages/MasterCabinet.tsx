import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { api, MasterDashboard, MasterLog, Shipment, Defect } from '@/lib/api'
import { SectionTitle, StatCard, Spinner, Card } from '@/components/UI'
import { Plus, Minus, Trash2, Pencil, Check, ChevronDown, ChevronUp, Box, Package, RefreshCw, Ruler, Truck, ShieldCheck, Wine, Target, DollarSign, AlertTriangle } from 'lucide-react'

interface UnifiedStock {
  sku: string
  name: string
  ready: number
  cases: number
  category: string
}

const CATEGORIES = [
  { id: 'standard', title: 'СТАНДАРТНІ ГРИЛІ', color: '#D4AF37', icon: Ruler },
  { id: 'large',    title: 'ВЕЛИКІ ГРИЛІ',    color: '#D4AF37', icon: Truck },
  { id: 'premium',  title: 'ПРЕМІУМ СЕРІЯ',   color: '#D4AF37', icon: ShieldCheck },
  { id: 'minibars', title: 'МІНІ-БАРИ',       color: '#D4AF37', icon: Wine },
]

export function MasterCabinet() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'plan'
  
  const [data, setData] = useState<MasterDashboard | null>(null)
  const [logs, setLogs] = useState<MasterLog[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
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
  
  // Стейт для акордеонів: балансу складу та групування відправок за днями
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [openShipmentDays, setOpenShipmentDays] = useState<Record<string, boolean>>({})

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
      const [d, l, items, s, df, stock] = await Promise.all([
        api.getMasterDashboard(user.name),
        api.getMasterLogs(user.name),
        api.getItems(),
        api.getShipments(),
        api.getDefects(),
        api.stock()
      ])
      setData(d)
      setLogs(l)
      setAvailableItems(items)
      setShipments(s)
      setDefects(df)
      
      const filtered = stock.filter(i => i.category === 'ready' || i.category === 'cases')
      const grouped = filtered.reduce((acc, item) => {
        const cleanSku = item.sku.trim()
        if (!acc[cleanSku]) {
          acc[cleanSku] = { 
            sku: cleanSku, 
            name: item.name, 
            ready: 0, 
            cases: 0, 
            category: parseCategory(cleanSku) 
          }
        }
        if (item.category === 'ready') acc[cleanSku].ready = item.qty
        if (item.category === 'cases') acc[cleanSku].cases = item.qty
        return acc
      }, {} as Record<string, UnifiedStock>)

      setUnifiedItems(Object.values(grouped))
      
      const initialFacts: Record<number, string> = {}
      d.tasks.forEach(t => {
        initialFacts[t.id] = String(t.completed)
      })
      setLocalFacts(initialFacts)

      // Автоматично розгортаємо найновіший день у відправках
      if (s.length > 0) {
        const sortedDates = [...new Set(s.map(item => item.shipment_date))].sort(
          (a, b) => new Date(b).getTime() - new Date(a).getTime()
        )
        if (sortedDates[0]) {
          setOpenShipmentDays(prev => ({ [sortedDates[0]]: true, ...prev }))
        }
      }

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

  const toggleShipmentDay = (date: string) => {
    setOpenShipmentDays(prev => ({ ...prev, [date]: !prev[date] }))
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
    } catch {}
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

  // ── ЛОГІКА СОРТУВАННЯ ТА АГРЕГАЦІЇ ВІДПРАВОК (ФОРМАТ N8N) ──
  const skuSortKey = (sku: string): number => {
    const match = sku.match(/^[GTМВCHB](\d+)/i)
    return match ? parseInt(match[1]) : 9999
  }

  // Назви ящиків (BOX) — повна відповідність n8n
  const BOX_NAMES: Record<string, string> = {
    'B01':'Автолюбитель стандарт','B02':'Автолюбитель максимум',
    'B03':'Полуничка','B04':'BBQ','B05':'Винний',
    'B06':'Пивний','B07':'Віскі','B08':'Лазня','B09':'Турист'
  }
  const BOX_SKUS = new Set(Object.keys(BOX_NAMES))


  const getGroupedShipments = () => {
    // extras зберігають числові значення як в n8n
    type AggregatedItem = { qty: number; extras: Record<string, number>; pickupTime?: string; boxNote?: string; boxName?: string }
    type CategoryData = Record<string, AggregatedItem>
    type DayData = {
      categories: {
        'Звичайні': CategoryData
        'Гравіювання': CategoryData
        'Туристичний': CategoryData
        'Бар': CategoryData
        'Ящик': CategoryData
        'Самовивіз': CategoryData
      }
      total: number
      pilnykCount: number
    }

    const grouped: Record<string, DayData> = {}

    const makeDay = (): DayData => ({
      categories: {
        'Звичайні': {},
        'Гравіювання': {},
        'Туристичний': {},
        'Бар': {},
        'Ящик': {},
        'Самовивіз': {},
      },
      total: 0,
      pilnykCount: 0,
    })

    shipments.forEach(s => {
      const date = s.shipment_date
      const rawArticle = (s.article || '').trim().toUpperCase()
      const comment = (s.raw_comment || '').toLowerCase()
      const qty = s.quantity || 0
      const isEngraved = !!s.is_engraved
      const isCase = !!s.is_case

      if (!grouped[date]) grouped[date] = makeDay()
      const day = grouped[date]

      // ── Визначення базового SKU (без H-суфіксу горіха) ──
      const isHazelnut = rawArticle.startsWith('G') && rawArticle.endsWith('H')
      const baseSku = isHazelnut ? rawArticle.replace(/H$/, '') : rawArticle

      // ── Визначення категорії (точно як в n8n) ──
      const isPickup = comment.includes('самовивіз') || comment.includes('до 16:30')
      const isTourist = rawArticle.startsWith('T')
      const isBar = rawArticle.startsWith('MB')
      const isBox = BOX_SKUS.has(rawArticle)

      // ── Ящик ──
      if (isBox) {
        const name = BOX_NAMES[rawArticle] || rawArticle
        let boxNote = ''
        if (comment.includes('закрит')) boxNote = 'закритий'
        else if (comment.includes('відкрит') || comment.includes('открит')) boxNote = 'відкритий'
        if (comment.includes('грав')) boxNote = boxNote ? boxNote + ', грав' : 'грав'
        const key = boxNote ? `${baseSku}||${boxNote}` : baseSku
        if (!day.categories['Ящик'][key]) {
          day.categories['Ящик'][key] = { qty: 0, extras: {}, boxName: name, boxNote }
        }
        day.categories['Ящик'][key].qty += qty
        return
      }

      // ── Туристичний ──
      if (isTourist) {
        if (!day.categories['Туристичний'][baseSku]) {
          day.categories['Туристичний'][baseSku] = { qty: 0, extras: {} }
        }
        day.categories['Туристичний'][baseSku].qty += qty
        day.total += qty
        // extras туристу
        if (comment.includes('без лого') || comment.includes('без гравіюван')) {
          day.categories['Туристичний'][baseSku].extras['без лого'] = (day.categories['Туристичний'][baseSku].extras['без лого'] || 0) + qty
        }
        return
      }

      // ── Бар ──
      if (isBar) {
        if (!day.categories['Бар'][baseSku]) {
          day.categories['Бар'][baseSku] = { qty: 0, extras: {} }
        }
        day.categories['Бар'][baseSku].qty += qty
        return
      }

      // ── ПИЛЬНИК — окремий рядок з БД, просто додаємо до лічильника ──
      if (rawArticle === 'ПИЛЬНИК') {
        day.pilnykCount += qty
        return
      }

      // ── Підрахунок загального ──
      day.total += qty

      // ── Збір extras (числові значення, порядок як в n8n) ──
      const extras: Record<string, number> = {}
      if (isHazelnut || comment.includes('горіх')) {
        extras['горіх'] = qty
      }
      if (comment.includes('без лого') || comment.includes('без гравіюван')) {
        extras['без лого'] = qty
      }
      // х2 / дві сторони
      if (comment.includes('х2') || comment.includes('дві сторони')) {
        extras['х2'] = 1
      }
      // чохол
      if (isCase || comment.includes('чохол')) {
        extras['чохол'] = qty
      }
      // шамп 2 сторони / шамп
      const shamp2match = comment.match(/(\d+)\s*шамп.*2\s*сторон/i)
      const shamp1match = comment.match(/(\d+)\s*шамп(?!.*2\s*сторон)/i)
      if (shamp2match) extras['шамп 2 сторони'] = parseInt(shamp2match[1])
      else if (shamp1match) extras['шамп'] = parseInt(shamp1match[1])
      // грав кейс
      if (comment.includes('грав кейс')) {
        extras['грав кейс'] = qty
      }

      // ── Самовивіз ──
      if (isPickup) {
        const pickupTime = comment.includes('до 16:30') ? 'до 16:30' : ''
        if (!day.categories['Самовивіз'][baseSku]) {
          day.categories['Самовивіз'][baseSku] = { qty: 0, extras: {}, pickupTime }
        }
        day.categories['Самовивіз'][baseSku].qty += qty
        // merge extras
        for (const [k, v] of Object.entries(extras)) {
          day.categories['Самовивіз'][baseSku].extras[k] = Math.max(day.categories['Самовивіз'][baseSku].extras[k] || 0, v)
        }
        if (pickupTime) day.categories['Самовивіз'][baseSku].pickupTime = pickupTime
        return
      }

      // ── Гравіювання або Звичайні ──
      const cat = isEngraved ? 'Гравіювання' : 'Звичайні'
      if (!day.categories[cat][baseSku]) {
        day.categories[cat][baseSku] = { qty: 0, extras: {} }
      }
      day.categories[cat][baseSku].qty += qty
      for (const [k, v] of Object.entries(extras)) {
        day.categories[cat][baseSku].extras[k] = Math.max(day.categories[cat][baseSku].extras[k] || 0, v)
      }
    })

    return grouped
  }



  if (loading && !data) return <Spinner />

  const groupedShipments = getGroupedShipments()

  return (
    <div className="min-h-screen pb-20 w-full" style={{
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-wood.png")'
    }}>
      <div className="p-4 pt-6 w-full">
        <div className="flex justify-between items-end mb-6">
          <div className="mb-4">
            <h1 className="font-display text-xl md:text-2xl text-[#c9963a] uppercase tracking-wider mb-2">Кабінет Майстра</h1>
            <p className="text-[var(--text-dim)] font-mono text-[10px] tracking-widest uppercase mt-1">
              {user?.name} • Цикл {data?.cycle}
            </p>
          </div>
          {/* Справжня кнопка синхронізації */}
          <button 
            onClick={loadData} 
            disabled={loading}
            className="p-3 bg-white/5 border border-white/10 text-white rounded-xl active:scale-95 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--orange)]' : ''}`} />
          </button>
        </div>

        {tab === 'plan' && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <StatCard icon={<Target className="w-6 h-6" />} value={data?.potential_earnings || 0} label="План, грн" accent="orange" />
            <StatCard icon={<DollarSign className="w-6 h-6" />} value={data?.current_earnings || 0} label="Виконано, грн" accent="green" />
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

        {/* ВКЛАДКА 3: ВІДПРАВКИ (TELEGRAM СТИЛЬ — ТОЧНА ВІДПОВІДНІСТЬ N8N) */}
        {tab === 'shipments' && (
          <div className="space-y-3">
            <SectionTitle>Лог відправок готової продукції</SectionTitle>
            {Object.keys(groupedShipments).length === 0 ? (
              <p className="text-xs text-[var(--text-dim)] font-mono text-center py-8">Відправок не знайдено</p>
            ) : (
              Object.entries(groupedShipments)
                .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                .map(([date, dayData]) => {
                  const isOpen = !!openShipmentDays[date]
                  const formattedDate = new Date(date).toLocaleDateString('uk-UA', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })

                  // Секції в чіткому порядку як в ТГ
                  const SECTION_ORDER = ['Звичайні', 'Гравіювання', 'Туристичний', 'Бар', 'Ящик', 'Самовивіз'] as const

                  return (
                    <div key={date} className="border border-white/5 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-md">
                      {/* Шапка-кнопка дня */}
                      <button
                        onClick={() => toggleShipmentDay(date)}
                        className="w-full p-4 flex items-center justify-between bg-white/[0.02] active:bg-white/[0.05] transition-colors"
                      >
                        <span className="font-mono text-sm font-bold text-white tracking-wide">
                          {formattedDate}
                        </span>
                        {isOpen ? <ChevronUp className="text-white/20" /> : <ChevronDown className="text-white/20" />}
                      </button>

                      {/* Розгорнутий список — точно як в ТГ */}
                      {isOpen && (
                        <div className="px-4 pb-4 pt-3 space-y-4 bg-black/40 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                          {SECTION_ORDER.map(catName => {
                            const items = dayData.categories[catName]
                            if (!items || Object.keys(items).length === 0) return null

                            return (
                              <div key={catName}>
                                {/* Заголовок секції — золотий, uppercase */}
                                <p className="text-[11px] font-bold text-[#c9963a] uppercase tracking-widest mb-1.5">
                                  {catName}
                                </p>
                                <ul className="space-y-[3px]">
                                  {Object.entries(items)
                                    .sort((a, b) => skuSortKey(a[0]) - skuSortKey(b[0]))
                                    .map(([key, item]) => {
                                      // Ящик — особливий рендер
                                      if (item.boxName !== undefined) {
                                        const noteStr = item.boxNote ? ` (${item.boxNote})` : ''
                                        return (
                                          <li key={key} className="flex items-baseline gap-1.5 font-mono text-[13px]">
                                            <span className="text-white/30">•</span>
                                            <span className="text-white">{item.boxName}</span>
                                            <span className="text-white/40">—</span>
                                            <span className="text-[#4ade80] font-bold">{item.qty}</span>
                                            {noteStr && <span className="text-white/40 text-[11px]">{noteStr}</span>}
                                          </li>
                                        )
                                      }

                                      // Порядок extras як в n8n
                                      const EXTRA_ORDER: Record<string, number> = {
                                        'горіх': 1, 'без лого': 2, 'х2': 3, 'чохол': 4,
                                        'шамп': 5, 'шамп 2 сторони': 6, 'грав кейс': 7
                                      }
                                      const sortedExtras = Object.entries(item.extras)
                                        .filter(([, v]) => v > 0)
                                        .sort((a, b) => (EXTRA_ORDER[a[0]] || 99) - (EXTRA_ORDER[b[0]] || 99))

                                      const parts: string[] = sortedExtras.map(([k, v]) =>
                                        k === 'х2' ? 'х2' : `${v} ${k}`
                                      )
                                      if (item.pickupTime) parts.push(item.pickupTime)

                                      const extrasStr = parts.length > 0 ? ` (${parts.join(', ')})` : ''

                                      return (
                                        <li key={key} className="flex items-baseline gap-1.5 font-mono text-[13px]">
                                          <span className="text-white/30">•</span>
                                          <span className="text-white font-medium">{key}</span>
                                          <span className="text-white/40">—</span>
                                          <span className="text-[#4ade80] font-bold">{item.qty}</span>
                                          {extrasStr && (
                                            <span className="text-white/50 text-[11px]">{extrasStr}</span>
                                          )}
                                        </li>
                                      )
                                    })}
                                </ul>
                              </div>
                            )
                          })}

                          {/* Футер — Разом + Пильник (як в ТГ) */}
                          <div className="pt-2 border-t border-white/5 space-y-0.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider">Підсумок дня:</span>
                              <span className="text-[13px] font-mono font-bold text-white">Разом — {dayData.total} шт</span>
                            </div>
                            {dayData.pilnykCount > 0 && (
                              <div className="flex justify-end">
                                <span className="text-[12px] font-mono text-[#c9963a]">Пильник — {dayData.pilnykCount} шт</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
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
                    <div className="p-3 space-y-3 animate-in slide-in-from-top-2 duration-300">
                      {catItems.length === 0 ? <div className="text-center py-6 text-white/20 text-sm italic">Немає даних</div> :
                        catItems.sort((a,b) => a.sku.localeCompare(b.sku)).map(item => (
                          <Card key={item.sku} className="bg-white/[0.03] border-white/5">
                            <div className="p-3 flex items-center justify-between gap-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-white leading-tight uppercase mb-0.5">{item.name.replace(/Гриль|Кейс/gi, '').trim()}</span>
                                <span className="text-[10px] text-white/40 font-mono tracking-wider">{item.sku}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex flex-col items-center">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <Box className="w-3 h-3 text-orange-500/50" />
                                    <span className={`text-lg font-display ${item.cases === 0 ? 'text-white/20' : 'text-white'}`}>{item.cases}</span>
                                  </div>
                                  <span className="text-[8px] text-white/30 uppercase font-bold tracking-tighter">Кейси</span>
                                </div>
                                <div className="w-[1px] h-8 bg-white/5" />
                                <div className="flex flex-col items-center">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <Package className="w-3 h-3 text-green-500/50" />
                                    <span className={`text-lg font-display ${item.ready === 0 ? 'text-white/20' : 'text-white'}`}>{item.ready}</span>
                                  </div>
                                  <span className="text-[8px] text-white/30 uppercase font-bold tracking-tighter">Готові</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

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