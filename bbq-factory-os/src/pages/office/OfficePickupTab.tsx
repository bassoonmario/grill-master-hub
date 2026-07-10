import { useState, useEffect, useCallback } from 'react'
import { Spinner, EmptyState, Card } from '@/components/UI'
import { api, PickupOrder } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Truck } from 'lucide-react'

// Іван — офісний override джерела резерву самовивозу. Не роль, конкретний tid.
const PICKUP_OVERRIDE_TIDS = new Set([334029])

const SOURCE_OPTIONS: { key: string; label: string }[] = [
  { key: 'office_stock', label: 'office_stock' },
  { key: 'finished',     label: 'finished' },
  { key: 'components',   label: 'Компоненти' },
]

function currentSource(order: PickupOrder, article: string): string {
  const rows = order.reservations.filter(r => r.article === article)
  if (rows.length === 0) return '—'
  const distinct = new Set(rows.map(r => r.source_table))
  if (distinct.size === 1) {
    const only = rows[0].source_table
    return only === 'office_stock' || only === 'finished' ? only : 'components'
  }
  return 'components'
}

export function OfficePickupTab() {
  const { user } = useAuth()
  const canOverrideSource = !!user && PICKUP_OVERRIDE_TIDS.has(user.tid)

  const [orders, setOrders] = useState<PickupOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getActivePickupOrders()
      setOrders(data)
    } catch (e) {
      setError('Не вдалося завантажити самовивози')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  const changeSource = async (order: PickupOrder, article: string, sourceTable: string) => {
    if (!user) return
    const key = `${order.id}:${article}`
    setSavingKey(key)
    setError(null)
    try {
      await api.setPickupSource(order.id, article, sourceTable, user.tid)
      await load()
    } catch (e: any) {
      setError(e.message ?? 'Помилка зміни джерела')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-3">
      {error && <div className="text-red-400 font-mono text-xs">{error}</div>}
      {orders.length === 0 && (
        <EmptyState icon={<Truck size={36} strokeWidth={1.2} />} text="Немає активних самовивозів" />
      )}
      {orders.map(order => (
        <Card key={order.id} className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-white">
              {order.client_name || order.source_order_id}
            </span>
            <span className="font-mono text-[10px] text-white/30">{order.source}:{order.source_order_id}</span>
          </div>
          {order.phone && <div className="font-mono text-[10px] text-white/30">{order.phone}</div>}
          <div className="divide-y divide-white/5 pt-1">
            {order.items.map(item => {
              const src = currentSource(order, item.article)
              const key = `${order.id}:${item.article}`
              return (
                <div key={item.article} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono text-xs text-white">
                    {item.article} <span className="text-[#c9963a]">×{item.quantity}</span>
                  </span>
                  {canOverrideSource ? (
                    <span className="flex rounded border border-white/10 overflow-hidden">
                      {SOURCE_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          disabled={savingKey === key}
                          onClick={() => changeSource(order, item.article, opt.key)}
                          className={`text-[10px] px-1.5 py-0.5 border-l border-white/10 first:border-l-0 transition-colors disabled:opacity-40 ${
                            src === opt.key
                              ? 'bg-[#c9963a]/20 text-[#c9963a]'
                              : 'bg-white/5 text-white/40 hover:text-white/60'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-white/30 uppercase">{src}</span>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      ))}
    </div>
  )
}
