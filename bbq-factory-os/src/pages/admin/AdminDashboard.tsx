import { useState, useEffect, useCallback } from 'react'
import { SectionTitle, Card, Spinner } from '@/components/UI'
import { ReplenishModal, ReplenishItem } from '@/components/ReplenishModal'
import { api, NotificationAlert, OfficeTask } from '@/lib/api'
import { AlertTriangle, Plus, Check, Package, ChevronUp, ChevronDown } from 'lucide-react'

export function AdminDashboard() {
  const [alerts, setAlerts] = useState<NotificationAlert[]>([])
  const [officeOrders, setOfficeOrders] = useState<OfficeTask[]>([])
  const [loading, setLoading] = useState(true)

  // Модалка замовлення
  const [orderingItem, setOrderingItem]         = useState<NotificationAlert | null>(null)
  const [orderDestination, setOrderDestination] = useState<'main' | 'operative'>('main')
  const [orderQty, setOrderQty]                 = useState<number>(0)
  const [orderComment, setOrderComment]         = useState('')
  const [orderPcsPerPack, setOrderPcsPerPack]   = useState('')
  const [orderPacksPerBox, setOrderPacksPerBox] = useState('')
  const [orderPcsPerBox, setOrderPcsPerBox]     = useState('')
  const [packagingLoading, setPackagingLoading] = useState(false)
  const [isSyncing, setIsSyncing]               = useState(false)
  const [openAlertSection, setOpenAlertSection] = useState<string | null>(null)
  const [replenishItem, setReplenishItem]       = useState<ReplenishItem | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [a, o] = await Promise.all([
        api.getNotifications(),
        api.getOfficePendingOrders().catch((): OfficeTask[] => []),
      ])
      setAlerts(a)
      setOfficeOrders(o)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openOrderModal = async (al: NotificationAlert) => {
    const dest: 'main' | 'operative' = al.source === 'inventory_operative' ? 'operative' : 'main'
    setOrderingItem(al)
    setOrderDestination(dest)
    setOrderQty(Math.ceil((al.limit_val - al.quantity) * 1.5) || 10)
    setOrderComment('')
    setOrderPcsPerPack('')
    setOrderPacksPerBox('')
    setOrderPcsPerBox('')
    setPackagingLoading(true)
    try {
      const rules = await api.getPackagingRules(al.item_id)
      setOrderPcsPerPack(rules.pcs_per_pack > 0 ? String(rules.pcs_per_pack) : '')
      setOrderPacksPerBox(rules.packs_per_box > 0 ? String(rules.packs_per_box) : '')
      setOrderPcsPerBox(rules.pcs_per_box > 0 ? String(rules.pcs_per_box) : '')
    } catch {
    } finally {
      setPackagingLoading(false)
    }
  }

  const closeOrderModal = () => {
    setOrderingItem(null)
    setOrderQty(0)
    setOrderComment('')
    setOrderPcsPerPack('')
    setOrderPacksPerBox('')
    setOrderPcsPerBox('')
  }

  const handleOrderSubmit = async () => {
    if (!orderingItem || orderQty <= 0) return
    setIsSyncing(true)
    const task_type = orderDestination === 'operative' ? 'internal' : 'supply'
    try {
      await api.createIncomingTask({
        task_type,
        item_id: orderingItem.item_id,
        target_qty: orderQty,
        admin_comment: orderComment || undefined,
        pcs_per_pack: orderPcsPerPack ? parseInt(orderPcsPerPack) : undefined,
        packs_per_box: orderPacksPerBox ? parseInt(orderPacksPerBox) : undefined,
        pcs_per_box: orderPcsPerBox ? parseInt(orderPcsPerBox) : undefined,
      })
      setAlerts(prev => prev.filter(al => al !== orderingItem))
      closeOrderModal()
    } catch {
      alert('Помилка замовлення')
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
      case 'loot_box_operative': return 'Ящики (буфер)'
      case 'loot_box_main': return 'Ящики (склад)'
      default: return source
    }
  }

  const skladAlerts     = alerts.filter(al => al.source === 'inventory_main')
  const furnitureAlerts = alerts.filter(al => al.source === 'cases_components' && !al.is_internal)
  const internalAlerts  = alerts.filter(al => al.source === 'cases_components' && al.is_internal)
  const lootBoxAlerts   = alerts.filter(al => al.source === 'loot_box_operative' || al.source === 'loot_box_main')

  const loadAlerts = loadData

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      
      {/* СЕКЦІЯ: АЛЯРМИ */}
      <div className="space-y-2">
        <SectionTitle>Критичні сповіщення</SectionTitle>

        {/* Акордеон 1: Склад */}
        {(() => {
          const count = skladAlerts.length
          const isEmpty = count === 0
          return (
            <div>
              <button
                onClick={() => !isEmpty && setOpenAlertSection(openAlertSection === 'sklad' ? null : 'sklad')}
                className={`w-full flex justify-between items-center p-4 rounded-xl border transition-colors ${isEmpty ? 'bg-[#0a0a0a] border-white/5 cursor-default' : 'bg-[#121212] border-white/10 hover:bg-[#1a1a1a]'}`}
              >
                <span className={`font-display text-lg uppercase tracking-wider ${isEmpty ? 'text-white/20' : 'text-white'}`}>
                  Склад
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${isEmpty ? 'text-white/20 border-white/10' : 'text-[#c9963a] border-[#c9963a]/30 bg-[#c9963a]/10'}`}>
                    {count}
                  </span>
                  {!isEmpty && (openAlertSection === 'sklad' ? <ChevronUp className="w-5 h-5 text-[#c9963a]" /> : <ChevronDown className="w-5 h-5 text-[#c9963a]" />)}
                </div>
              </button>
              {openAlertSection === 'sklad' && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {skladAlerts.map((al, idx) => (
                    <Card key={idx} className="bg-gradient-to-br from-[#1a1400] to-[#0a0a0a] border border-[#c9963a]/30 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[#c9963a] font-bold uppercase text-xs flex items-center gap-2 tracking-wider">
                            <AlertTriangle className="w-4 h-4" />{al.item_id}
                          </span>
                        </div>
                        <p className="text-sm font-mono text-white/80 mt-2 mb-4">
                          Залишок: <span className="text-red-400 font-bold">{al.quantity}</span> (Ліміт: {al.limit_val})
                        </p>
                      </div>
                      <button onClick={() => openOrderModal(al)} className="w-full py-2 bg-[#c9963a]/10 hover:bg-[#c9963a]/20 text-[#c9963a] border border-[#c9963a]/30 rounded-lg text-xs font-bold uppercase tracking-widest active:scale-95 transition-all">
                        Замовити
                      </button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Акордеон 2: Фурнітура (is_internal = false) */}
        {(() => {
          const count = furnitureAlerts.length
          const isEmpty = count === 0
          return (
            <div>
              <button
                onClick={() => !isEmpty && setOpenAlertSection(openAlertSection === 'furniture' ? null : 'furniture')}
                className={`w-full flex justify-between items-center p-4 rounded-xl border transition-colors ${isEmpty ? 'bg-[#0a0a0a] border-white/5 cursor-default' : 'bg-[#121212] border-white/10 hover:bg-[#1a1a1a]'}`}
              >
                <span className={`font-display text-lg uppercase tracking-wider ${isEmpty ? 'text-white/20' : 'text-white'}`}>
                  Фурнітура
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${isEmpty ? 'text-white/20 border-white/10' : 'text-[#c9963a] border-[#c9963a]/30 bg-[#c9963a]/10'}`}>
                    {count}
                  </span>
                  {!isEmpty && (openAlertSection === 'furniture' ? <ChevronUp className="w-5 h-5 text-[#c9963a]" /> : <ChevronDown className="w-5 h-5 text-[#c9963a]" />)}
                </div>
              </button>
              {openAlertSection === 'furniture' && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {furnitureAlerts.map((al, idx) => (
                    <Card key={idx} className="bg-gradient-to-br from-[#1a1400] to-[#0a0a0a] border border-[#c9963a]/30 p-4 flex flex-col justify-between">
                      <div>
                        <span className="text-[#c9963a] font-bold uppercase text-xs flex items-center gap-2 tracking-wider">
                          <AlertTriangle className="w-4 h-4" />{al.item_id}
                        </span>
                        <p className="text-sm font-mono text-white/80 mt-2 mb-4">
                          Залишок: <span className="text-red-400 font-bold">{al.quantity}</span> (Ліміт: {al.limit_val})
                        </p>
                      </div>
                      <button onClick={() => setReplenishItem({ id: al.id ?? '', name: al.item_id, unit_type: al.unit_type || 'pcs', conversion_factor: al.conversion_factor || 1, is_internal: false })} className="w-full py-2 bg-[#c9963a]/10 hover:bg-[#c9963a]/20 text-[#c9963a] border border-[#c9963a]/30 rounded-lg text-xs font-bold uppercase tracking-widest active:scale-95 transition-all">
                        Поповнити
                      </button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Акордеон 3: Внутрішні (is_internal = true) */}
        {(() => {
          const count = internalAlerts.length
          const isEmpty = count === 0
          return (
            <div>
              <button
                onClick={() => !isEmpty && setOpenAlertSection(openAlertSection === 'internal' ? null : 'internal')}
                className={`w-full flex justify-between items-center p-4 rounded-xl border transition-colors ${isEmpty ? 'bg-[#0a0a0a] border-white/5 cursor-default' : 'bg-[#121212] border-white/10 hover:bg-[#1a1a1a]'}`}
              >
                <span className={`font-display text-lg uppercase tracking-wider ${isEmpty ? 'text-white/20' : 'text-white'}`}>
                  Внутрішні
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${isEmpty ? 'text-white/20 border-white/10' : 'text-[#c9963a] border-[#c9963a]/30 bg-[#c9963a]/10'}`}>
                    {count}
                  </span>
                  {!isEmpty && (openAlertSection === 'internal' ? <ChevronUp className="w-5 h-5 text-[#c9963a]" /> : <ChevronDown className="w-5 h-5 text-[#c9963a]" />)}
                </div>
              </button>
              {openAlertSection === 'internal' && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {internalAlerts.map((al, idx) => (
                    <Card key={idx} className="bg-gradient-to-br from-[#1a1400] to-[#0a0a0a] border border-[#c9963a]/30 p-4 flex flex-col justify-between">
                      <div>
                        <span className="text-[#c9963a] font-bold uppercase text-xs flex items-center gap-2 tracking-wider">
                          <AlertTriangle className="w-4 h-4" />{al.item_id}
                        </span>
                        <p className="text-sm font-mono text-white/80 mt-2 mb-4">
                          Залишок: <span className="text-yellow-400 font-bold">{al.quantity}</span> (Ліміт: {al.limit_val})
                        </p>
                      </div>
                      <button onClick={() => setReplenishItem({ id: al.id ?? '', name: al.item_id, unit_type: al.unit_type || 'pcs', conversion_factor: al.conversion_factor || 1, is_internal: true })} className="w-full py-2 bg-[#c9963a]/10 hover:bg-[#c9963a]/20 text-[#c9963a] border border-[#c9963a]/30 rounded-lg text-xs font-bold uppercase tracking-widest active:scale-95 transition-all">
                        Поповнити
                      </button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
        {/* Акордеон 4: Ящики */}
        {(() => {
          const count = lootBoxAlerts.length
          const isEmpty = count === 0
          return (
            <div>
              <button
                onClick={() => !isEmpty && setOpenAlertSection(openAlertSection === 'lootbox' ? null : 'lootbox')}
                className={`w-full flex justify-between items-center p-4 rounded-xl border transition-colors ${isEmpty ? 'bg-[#0a0a0a] border-white/5 cursor-default' : 'bg-[#121212] border-white/10 hover:bg-[#1a1a1a]'}`}
              >
                <span className={`font-display text-lg uppercase tracking-wider ${isEmpty ? 'text-white/20' : 'text-white'}`}>
                  Ящики
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${isEmpty ? 'text-white/20 border-white/10' : 'text-[#c9963a] border-[#c9963a]/30 bg-[#c9963a]/10'}`}>
                    {count}
                  </span>
                  {!isEmpty && (openAlertSection === 'lootbox' ? <ChevronUp className="w-5 h-5 text-[#c9963a]" /> : <ChevronDown className="w-5 h-5 text-[#c9963a]" />)}
                </div>
              </button>
              {openAlertSection === 'lootbox' && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lootBoxAlerts.map((al, idx) => (
                    <Card key={idx} className="bg-gradient-to-br from-[#1a1400] to-[#0a0a0a] border border-[#c9963a]/30 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[#c9963a] font-bold uppercase text-xs flex items-center gap-2 tracking-wider">
                            <AlertTriangle className="w-4 h-4" />{al.item_id}
                          </span>
                        </div>
                        <p className="text-sm font-mono text-white/80 mt-2 mb-4">
                          Залишок: <span className="text-red-400 font-bold">{al.quantity}</span> (Ліміт: {al.limit_val})
                        </p>
                        <p className="text-[10px] font-mono text-white/30 uppercase">{formatSource(al.source)}</p>
                      </div>
                      <button onClick={() => openOrderModal(al)} className="w-full py-2 bg-[#c9963a]/10 hover:bg-[#c9963a]/20 text-[#c9963a] border border-[#c9963a]/30 rounded-lg text-xs font-bold uppercase tracking-widest active:scale-95 transition-all">
                        Замовити
                      </button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Акордеон 5: Замовлення офісу */}
        {(() => {
          const count = officeOrders.length
          const isEmpty = count === 0
          return (
            <div>
              <button
                onClick={() => !isEmpty && setOpenAlertSection(openAlertSection === 'office' ? null : 'office')}
                className={`w-full flex justify-between items-center p-4 rounded-xl border transition-colors ${isEmpty ? 'bg-[#0a0a0a] border-white/5 cursor-default' : 'bg-[#121212] border-white/10 hover:bg-[#1a1a1a]'}`}
              >
                <span className={`font-display text-lg uppercase tracking-wider ${isEmpty ? 'text-white/20' : 'text-white'}`}>
                  Замовлення офісу
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${isEmpty ? 'text-white/20 border-white/10' : 'text-[#c9963a] border-[#c9963a]/30 bg-[#c9963a]/10'}`}>
                    {count}
                  </span>
                  {!isEmpty && (openAlertSection === 'office' ? <ChevronUp className="w-5 h-5 text-[#c9963a]" /> : <ChevronDown className="w-5 h-5 text-[#c9963a]" />)}
                </div>
              </button>
              {openAlertSection === 'office' && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {officeOrders.map(o => (
                    <Card key={o.id} className="bg-gradient-to-br from-[#1a1400] to-[#0a0a0a] border border-[#c9963a]/30 p-4">
                      <p className="text-sm font-mono text-white/80 break-words">{o.admin_comment}</p>
                      <p className="text-[10px] font-mono text-white/30 uppercase mt-2">
                        {o.created_by ?? 'Офіс'} · {o.created_at} · {o.status}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      <ReplenishModal
        item={replenishItem}
        onClose={() => setReplenishItem(null)}
        onSuccess={loadAlerts}
        showWarehouseSelect={!replenishItem?.is_internal}
      />

      {/* МОДАЛКА ЗАМОВЛЕННЯ */}
      {orderingItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <Card className="w-full max-w-sm border border-[#c9963a]/30 bg-[#121212] shadow-[0_0_30px_rgba(201,150,58,0.1)] max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <h3 className="text-[#c9963a] font-bold uppercase text-sm tracking-widest flex items-center gap-2">
                <Plus className="w-4 h-4" /> Нове постачання
              </h3>

              {/* Артикул */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase font-mono mb-1 tracking-widest">Артикул</label>
                <input
                  type="text"
                  readOnly
                  value={orderingItem.item_id}
                  className="w-full bg-black/50 border border-white/5 rounded-lg p-3 text-white/50 text-sm font-mono outline-none"
                />
              </div>

              {/* Склад */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase font-mono mb-1.5 tracking-widest">Склад призначення</label>
                <div className="flex">
                  {(['main', 'operative'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setOrderDestination(d)}
                      className="flex-1 py-2.5 font-mono text-[11px] tracking-widest uppercase transition-all first:rounded-l-lg last:rounded-r-lg border"
                      style={{
                        background:  orderDestination === d ? 'rgba(201,150,58,0.15)' : 'transparent',
                        color:       orderDestination === d ? '#c9963a' : 'rgba(255,255,255,0.3)',
                        borderColor: orderDestination === d ? 'rgba(201,150,58,0.4)' : 'rgba(255,255,255,0.1)',
                      }}
                    >
                      {d === 'main' ? 'Основний' : 'Майстерня'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Кількість */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase font-mono mb-1 tracking-widest">Кількість (шт)</label>
                <input
                  type="number"
                  value={orderQty}
                  onChange={e => setOrderQty(parseInt(e.target.value) || 0)}
                  className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-center font-display text-xl outline-none focus:border-[#c9963a]"
                />
              </div>

              {/* Фасування */}
              <div className="bg-[#0e0e0e] border border-white/5 rounded-xl p-4">
                <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Package className="w-3 h-3" />
                  Правила фасовки
                  {packagingLoading && <span className="text-[#c9963a] animate-pulse">завантаження...</span>}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] font-mono text-white/20 uppercase block mb-1.5">шт/пачка</label>
                    <input
                      type="number"
                      value={orderPcsPerPack}
                      onChange={e => setOrderPcsPerPack(e.target.value)}
                      placeholder="0"
                      className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-center text-white font-mono text-sm outline-none focus:border-[#c9963a]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-white/20 uppercase block mb-1.5">пачок/ящик</label>
                    <input
                      type="number"
                      value={orderPacksPerBox}
                      onChange={e => setOrderPacksPerBox(e.target.value)}
                      placeholder="0"
                      className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-center text-white font-mono text-sm outline-none focus:border-[#c9963a]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-white/20 uppercase block mb-1.5">шт/ящик</label>
                    <input
                      type="number"
                      value={orderPcsPerBox}
                      onChange={e => setOrderPcsPerBox(e.target.value)}
                      placeholder="0"
                      className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-center text-white font-mono text-sm outline-none focus:border-[#c9963a]/50"
                    />
                  </div>
                </div>
              </div>

              {/* Коментар */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase font-mono mb-1 tracking-widest">Коментар</label>
                <input
                  type="text"
                  value={orderComment}
                  placeholder="Додаткові примітки (необов'язково)"
                  onChange={e => setOrderComment(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm font-mono outline-none focus:border-[#c9963a]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeOrderModal}
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
