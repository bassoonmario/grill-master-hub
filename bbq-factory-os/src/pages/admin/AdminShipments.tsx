import { useState, useEffect, useCallback, useRef } from 'react'
import { SectionTitle, Spinner, Tabs } from '@/components/UI'
import { ShipmentsLog } from '@/components/ShipmentsLog'
import { api, Shipment, WholesaleOrderItem, WholesaleComponentRow, StockItem } from '@/lib/api'

const inputClass = "w-20 bg-black border border-[#c9963a] rounded p-1.5 text-center text-white font-mono text-xs outline-none"

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function AdminShipments() {
  const [subTab, setSubTab] = useState<'log' | 'wholesale'>('log')
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [wholesaleItems, setWholesaleItems] = useState<WholesaleOrderItem[]>([])
  const [overview, setOverview] = useState<WholesaleComponentRow[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, items, ov, st] = await Promise.all([
        api.getShipmentsAdmin(),
        api.getWholesaleItems(),
        api.getWholesaleOverview(),
        api.stock(),
      ])
      const parsed = s.map(item => ({
        ...item,
        extras: typeof item.extras === 'string' ? JSON.parse(item.extras) : (item.extras ?? {})
      }))
      setShipments(parsed)
      setWholesaleItems(items)
      setOverview(ov)
      setStock(st)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const finishedQty = (article: string) => stock.find(i => i.category === 'ready' && i.sku === article)?.qty ?? 0
  const warehouseQty = (article: string) => stock.find(i => i.category === 'finished_main' && i.sku === article)?.qty ?? 0

  const refreshOverview = useCallback(async () => {
    try {
      const ov = await api.getWholesaleOverview()
      setOverview(ov)
    } catch {
      // не критично, оновиться на наступному завантаженні
    }
  }, [])

  const applySource = (item: WholesaleOrderItem, from_master: number, from_warehouse: number, from_scratch: number) => {
    const key = `${item.order_id}:${item.article}`

    setWholesaleItems(prev => prev.map(w =>
      w.order_id === item.order_id && w.article === item.article
        ? { ...w, from_master, from_warehouse, from_scratch }
        : w
    ))

    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(async () => {
      try {
        await api.setWholesaleSource(item.order_id, { article: item.article, from_master, from_warehouse, from_scratch })
        refreshOverview()
      } catch {
        alert(`Помилка збереження розподілу для ${item.article}`)
      }
    }, 400)
  }

  const handleMasterChange = (item: WholesaleOrderItem, raw: string) => {
    const newMaster = clamp(Number(raw) || 0, 0, Math.min(item.qty, finishedQty(item.article)))
    const newWarehouse = clamp(item.from_warehouse, 0, Math.min(warehouseQty(item.article), item.qty - newMaster))
    const newScratch = item.qty - newMaster - newWarehouse
    applySource(item, newMaster, newWarehouse, newScratch)
  }

  const handleWarehouseChange = (item: WholesaleOrderItem, raw: string) => {
    const newWarehouse = clamp(Number(raw) || 0, 0, Math.min(warehouseQty(item.article), item.qty - item.from_master))
    const newScratch = item.qty - item.from_master - newWarehouse
    applySource(item, item.from_master, newWarehouse, newScratch)
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-3">
      <Tabs
        tabs={[
          { key: 'log', label: 'Відправки' },
          { key: 'wholesale', label: 'Опт' },
        ]}
        active={subTab}
        onChange={k => setSubTab(k as 'log' | 'wholesale')}
        variant="underline"
      />

      {subTab === 'log' && (
        <ShipmentsLog shipments={shipments} />
      )}

      {subTab === 'wholesale' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <SectionTitle>Розподіл джерел</SectionTitle>
            {wholesaleItems.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)] font-mono text-center py-8">Активних оптових позицій немає</p>
            ) : (
              wholesaleItems.map(item => (
                <div key={`${item.order_id}:${item.article}`} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-white">{item.article}</span>
                    <span className="font-mono text-xs text-white/40">Замовлено: {item.qty}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-mono text-white/40 uppercase">З майстерні</span>
                      <input
                        type="number"
                        className={inputClass}
                        value={item.from_master}
                        onChange={e => handleMasterChange(item, e.target.value)}
                      />
                      <span className="text-[9px] text-white/30 font-mono">макс {Math.min(item.qty, finishedQty(item.article))}</span>
                    </label>
                    <label className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-mono text-white/40 uppercase">Зі складу</span>
                      <input
                        type="number"
                        className={inputClass}
                        value={item.from_warehouse}
                        onChange={e => handleWarehouseChange(item, e.target.value)}
                      />
                      <span className="text-[9px] text-white/30 font-mono">макс {Math.min(item.qty - item.from_master, warehouseQty(item.article))}</span>
                    </label>
                    <label className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-mono text-white/40 uppercase">З нуля</span>
                      <input
                        type="number"
                        className={`${inputClass} opacity-60`}
                        value={item.from_scratch}
                        readOnly
                      />
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <SectionTitle>Компоненти — заброньовано / є на складах</SectionTitle>
            {overview.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)] font-mono text-center py-8">Немає активних резервів по компонентах</p>
            ) : (
              <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                <div className="grid grid-cols-3 gap-2 p-3 bg-white/5 border-b border-white/5 text-[10px] font-mono text-white/40 uppercase">
                  <span>Компонент</span>
                  <span className="text-center">Заброньовано</span>
                  <span className="text-center">Є на складах</span>
                </div>
                <div className="divide-y divide-white/5">
                  {overview.map(row => (
                    <div key={row.item_id} className="grid grid-cols-3 gap-2 p-3 items-center font-mono text-sm">
                      <span className="text-white/80">{row.item_id}</span>
                      <span className="text-center text-[#c9963a]">{row.reserved}</span>
                      <span className={`text-center font-bold ${row.available < 0 ? 'text-red-400' : 'text-[#4ade80]'}`}>{row.available}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
