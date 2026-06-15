import { useState, useEffect, useCallback } from 'react'
import { SectionTitle, Card, Spinner } from '@/components/UI'
import { api, GlobalStat, NotificationAlert } from '@/lib/api'
import { AlertTriangle, Plus, Check } from 'lucide-react'

export function AdminDashboard() {
  const [stats, setStats] = useState<GlobalStat[]>([])
  const [alerts, setAlerts] = useState<NotificationAlert[]>([])
  const [loading, setLoading] = useState(true)

  // Новий Supply Task 
  const [orderingItem, setOrderingItem] = useState<NotificationAlert | null>(null)
  const [orderQty, setOrderQty] = useState<number>(0)
  const [orderComment, setOrderComment] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [s, a] = await Promise.all([
        api.getGlobalStats(),
        api.getNotifications()
      ])
      setStats(s)
      setAlerts(a)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOrderSubmit = async () => {
    if (!orderingItem || orderQty <= 0) return
    setIsSyncing(true)
    try {
      await api.createIncomingTask({ task_type: 'supply', item_id: orderingItem.item_id, target_qty: orderQty, admin_comment: orderComment })
      setAlerts(prev => prev.filter(al => al !== orderingItem))
      setOrderingItem(null)
      setOrderQty(0)
      setOrderComment('')
    } catch (e) {
      alert("Помилка замовлення")
    } finally {
      setIsSyncing(false)
    }
  }

  const formatSource = (source: string) => {
    switch (source) {
      case 'inventory_main': return 'Основний склад'
      case 'inventory_operative': return 'Буфер цеху'
      case 'cases_components': return 'Фурнітура'
      case 'defects': return 'Брак'
      default: return source
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      
      {/* СЕКЦІЯ: АЛЯРМИ */}
      <div className="space-y-4">
        <SectionTitle>Критичні сповіщення</SectionTitle>
        {alerts.length === 0 ? (
          <p className="text-xs text-[var(--text-dim)] font-mono py-4 uppercase">Все під контролем, алярмів немає.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((al, idx) => (
              <Card key={idx} className="bg-gradient-to-br from-[#1a1400] to-[#0a0a0a] border border-[#c9963a]/30 p-4 flex flex-col justify-between shadow-[0_0_15px_rgba(201,150,58,0.05)]">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[#c9963a] font-bold uppercase text-xs flex items-center gap-2 tracking-wider">
                      <AlertTriangle className="w-4 h-4" /> 
                      {al.item_id}
                    </span>
                    <span className="text-[10px] font-mono text-white/40 uppercase bg-black/50 px-2 py-0.5 rounded border border-white/5">
                      {formatSource(al.source)}
                    </span>
                  </div>
                  {al.source === 'defects' ? (
                    <p className="text-sm font-mono text-white/80 mt-2 mb-4">
                      Зафіксовано неполадку. Очікує ремонту.
                    </p>
                  ) : (
                    <p className="text-sm font-mono text-white/80 mt-2 mb-4">
                      Залишок: <span className="text-red-400 font-bold">{al.quantity}</span> (Ліміт: {al.limit_val})
                    </p>
                  )}
                </div>

                {al.source !== 'defects' && (
                  <button 
                    onClick={() => {
                      setOrderingItem(al)
                      setOrderQty(Math.ceil((al.limit_val - al.quantity) * 1.5) || 10)
                      setOrderComment('')
                    }}
                    className="w-full py-2 bg-[#c9963a]/10 hover:bg-[#c9963a]/20 text-[#c9963a] border border-[#c9963a]/30 rounded-lg text-xs font-bold uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Замовити
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* СЕКЦІЯ: СТАТИСТИКА */}
      <div className="space-y-4 pt-4">
        <SectionTitle>Зарплатний фонд майстрів (Поточний місяць)</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map(s => (
            <Card key={s.master_name} className="bg-[#121212] border border-white/10 p-5 p-0">
              <div className="p-4 border-b border-white/5">
                <h3 className="text-white font-display text-lg uppercase tracking-wider">{s.master_name}</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-mono uppercase tracking-widest text-[var(--text-dim)]">
                  <span>Цикл 01-15</span>
                  <span className="text-white font-medium">{s.earn_1_15} ₴</span>
                </div>
                <div className="flex justify-between items-center text-xs font-mono uppercase tracking-widest text-[var(--text-dim)]">
                  <span>Цикл 16-кін</span>
                  <span className="text-white font-medium">{s.earn_16_end} ₴</span>
                </div>
                <div className="pt-3 mt-3 border-t border-white/5 flex justify-between items-center text-sm font-bold uppercase tracking-widest text-[#c9963a]">
                  <span>Разом</span>
                  <span>{s.total} ₴</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* МОДАЛКА ЗАМОВЛЕННЯ */}
      {orderingItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm shadow-2xl">
          <Card className="w-full max-w-sm border border-[#c9963a]/30 bg-[#121212] shadow-[0_0_30px_rgba(201,150,58,0.1)]">
            <div className="p-6">
              <h3 className="text-[#c9963a] font-bold uppercase text-sm tracking-widest mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Нове постачання
              </h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase font-mono mb-1 tracking-widest">Артикул</label>
                  <input
                    type="text"
                    readOnly
                    value={orderingItem.item_id}
                    className="w-full bg-black/50 border border-white/5 rounded-lg p-3 text-white/50 text-sm font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase font-mono mb-1 tracking-widest">Кількість (Шт)</label>
                  <input
                    type="number"
                    value={orderQty}
                    onChange={(e) => setOrderQty(parseInt(e.target.value) || 0)}
                    className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-center font-display text-xl outline-none focus:border-[#c9963a]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase font-mono mb-1 tracking-widest">Фасовка / Примітка</label>
                  <input
                    type="text"
                    value={orderComment}
                    placeholder="Напр., пачка на 250 шт."
                    onChange={(e) => setOrderComment(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm outline-none focus:border-[#c9963a]"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setOrderingItem(null)} 
                  className="flex-1 py-3 text-gray-400 text-xs font-mono uppercase tracking-widest rounded-xl border border-white/5 hover:bg-white/5 active:scale-95 transition-all"
                >
                  Скасувати
                </button>
                <button 
                  onClick={handleOrderSubmit} 
                  disabled={isSyncing || orderQty <= 0} 
                  className="flex-1 py-3 bg-[#c9963a] text-black font-black text-xs font-mono uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 shadow-lg hover:brightness-110 disabled:opacity-50 active:scale-95 transition-all"
                >
                  {isSyncing ? <Spinner /> : <><Check className="w-4 h-4" /> Відправити</>}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

    </div>
  )
}
