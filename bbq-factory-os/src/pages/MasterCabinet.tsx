import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { api, MasterDashboard, MasterStatPeriod } from '@/lib/api'
import { SectionTitle, StatCard, Spinner, Card } from '@/components/UI'
import { Plus, Minus, Trash2, TrendingUp, History, Star, AlertCircle, Save } from 'lucide-react'

export function MasterCabinet() {
  const { user, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<'plan' | 'stats'>('plan')
  const [data, setData] = useState<MasterDashboard | null>(null)
  const [stats, setStats] = useState<MasterStatPeriod[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [availableItems, setAvailableItems] = useState<string[]>([])
  const [newItem, setNewItem] = useState({ case_sku: '', quantity: 10 })

  // Local state for input values to avoid stuttering
  const [localFacts, setLocalFacts] = useState<Record<number, string>>({})

  const loadData = async () => {
    if (!user) return
    try {
      setLoading(true)
      const [d, s, items] = await Promise.all([
        api.getMasterDashboard(user.name),
        api.getMasterStats(user.name),
        api.getItems()
      ])
      setData(d)
      setStats(s)
      setAvailableItems(items)
      
      // Initialize local facts
      const initialFacts: Record<number, string> = {}
      d.tasks.forEach(t => {
        initialFacts[t.id] = String(t.completed)
      })
      setLocalFacts(initialFacts)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    if (!authLoading) {
        loadData() 
    }
  }, [user, authLoading])

  const handleLogWork = async (taskId: number, itemCode: string, newTotal: number, currentCompleted: number) => {
    if (!user) return
    const diff = newTotal - currentCompleted
    if (diff === 0) return

    setIsSyncing(true)
    try {
      await api.logWork(user.name, itemCode, diff)
      await loadData() // Refresh everything
    } catch (err) {
      alert('Помилка збереження')
      // Reset local state on error
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

  if (loading && !data) return <Spinner />

  return (
    <div className="min-h-screen pb-20" style={{
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-wood.png")'
    }}>
      {/* Header Overlay for Premium feel */}
      <div className="p-4 pt-6">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="font-display text-3xl text-white tracking-tight uppercase">Кабінет Майстра</h1>
            <p className="text-[var(--text-dim)] font-mono text-[10px] tracking-widest uppercase mt-1">
              {user?.name} • Цикл {data?.cycle}
            </p>
          </div>
          <History 
            className={`w-6 h-6 ${tab === 'stats' ? 'text-[var(--orange)]' : 'text-gray-600'} transition-colors`} 
            onClick={() => setTab(tab === 'plan' ? 'stats' : 'plan')}
          />
        </div>

        {/* Dashboard Widgets */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatCard 
            icon="🎯" 
            value={data?.potential_earnings || 0} 
            label="План, грн" 
            accent="orange" 
          />
          <StatCard 
            icon="💰" 
            value={data?.current_earnings || 0} 
            label="Виконано, грн" 
            accent="green" 
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-black/40 p-1 rounded-xl border border-white/5">
          <button 
            onClick={() => setTab('plan')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-mono tracking-widest uppercase transition-all ${tab === 'plan' ? 'bg-[var(--orange)] text-black font-bold shadow-lg shadow-orange-500/20' : 'text-gray-500'}`}
          >
            Мій План
          </button>
          <button 
            onClick={() => setTab('stats')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-mono tracking-widest uppercase transition-all ${tab === 'stats' ? 'bg-[var(--orange)] text-black font-bold shadow-lg shadow-orange-500/20' : 'text-gray-500'}`}
          >
            Статистика
          </button>
        </div>

        {tab === 'plan' ? (
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

            {/* Add Task Form Overlay/Card */}
            {isAdding && (
              <Card className="border-2 border-[var(--orange)] shadow-[0_0_20px_rgba(255,140,66,0.2)] animate-in fade-in zoom-in duration-300">
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
                      <div className="flex items-center gap-3">
                         <input 
                           type="number"
                           value={newItem.quantity}
                           onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                           className="flex-1 bg-black border border-white/10 rounded-lg p-3 text-white text-center font-display text-xl outline-none focus:border-[var(--orange)]"
                         />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => setIsAdding(false)}
                        className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-xs font-bold uppercase"
                      >
                        Скасувати
                      </button>
                      <button 
                        onClick={handleAddTask}
                        disabled={!newItem.case_sku || isSyncing}
                        className="flex-[2] py-3 rounded-xl bg-[var(--orange)] text-black text-xs font-black uppercase shadow-lg disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                      >
                        {isSyncing ? <Spinner /> : <Plus className="w-4 h-4" />} Додати в план
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {data?.tasks.map(task => (
              <Card key={task.id} className={`group relative transition-all border-l-4 ${task.is_priority ? 'border-l-[var(--orange)]' : 'border-l-transparent'} bg-[#121212]`}>
                <div className="p-4">
                  {/* Priority Badge */}
                  {task.is_priority && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black text-[9px] font-bold px-2 py-0.5 rounded shadow-lg animate-pulse">
                      <Star className="w-3 h-3 fill-current" /> ПРІОРИТЕТ
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-white font-medium text-lg leading-tight uppercase tracking-tight">{task.case_sku}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="font-mono text-[11px] text-[var(--text-dim)]">План: {task.quantity} шт</span>
                    </div>
                  </div>

                  {/* Fact Entry Area */}
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => handleQuickAdjust(task.id, task.case_sku, task.completed, -1)}
                      disabled={isSyncing || task.completed <= 0}
                      className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl active:bg-red-500/20 active:border-red-500/40 disabled:opacity-20"
                    >
                      <Minus className="w-5 h-5 text-red-500" />
                    </button>

                    <div className="flex-1 relative">
                       <input 
                         type="number" 
                         value={localFacts[task.id] ?? ''}
                         onChange={(e) => handleInputChange(task.id, e.target.value)}
                         onBlur={(e) => {
                           const val = parseInt(e.target.value);
                           if (isNaN(val)) return;
                           const diff = val < 0 ? val : (val - task.completed);
                           if (diff !== 0) {
                             handleLogWork(task.id, task.case_sku, task.completed + diff, task.completed);
                           }
                         }}
                         className="w-full h-12 bg-black/60 border border-white/10 rounded-xl text-center text-xl font-display text-white focus:border-[var(--orange)] focus:ring-1 focus:ring-[var(--orange)] outline-none transition-all"
                       />
                       <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#D4AF37] text-black text-[8px] font-bold px-1.5 rounded uppercase tracking-tighter">Факт</div>
                    </div>

                    <button 
                      onClick={() => handleQuickAdjust(task.id, task.case_sku, task.completed, 1)}
                      disabled={isSyncing}
                      className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl active:bg-green-500/20 active:border-green-500/40 disabled:opacity-20"
                    >
                      <Plus className="w-5 h-5 text-green-500" />
                    </button>
                    
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="w-10 h-10 flex items-center justify-center text-gray-700 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-500 bg-gradient-to-r from-[var(--orange)] to-yellow-500"
                      style={{ width: `${Math.min(100, (task.completed / task.quantity) * 100)}%` }}
                    />
                  </div>
                </div>
              </Card>
            ))}
            
            {data?.tasks.length === 0 && (
              <div className="py-12 text-center text-[var(--text-dim)] font-mono text-xs border border-dashed border-white/10 rounded-2xl">
                План порожній. Додайте моделі для роботи.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <SectionTitle>Історія по циклах</SectionTitle>
            {stats?.map((stat, i) => (
              <div key={i} className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                <div className="bg-white/5 px-4 py-3 flex justify-between items-center border-b border-white/5">
                  <span className="font-mono text-xs text-white uppercase tracking-widest">{stat.period}</span>
                  <span className="font-display text-lg text-[var(--orange)]">{stat.earnings.toLocaleString()} ₴</span>
                </div>
                <div className="p-4 space-y-2">
                  {stat.models.map((m, mi) => (
                    <div key={mi} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-lg">
                      <span className="text-sm text-gray-300 uppercase tracking-tight">{m.name}</span>
                      <span className="font-mono text-sm text-[var(--orange)] font-bold">{m.qty} шт</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
