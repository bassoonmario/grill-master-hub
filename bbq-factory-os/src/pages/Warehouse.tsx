import { useEffect, useState } from 'react'
import { api, StockItem } from '@/lib/api'
import { SectionTitle, Spinner } from '@/components/UI'

type Tab = 'main' | 'ready' | 'operative'

const TABS: { id: Tab; label: string }[] = [
  { id: 'main',      label: 'Основний' },
  { id: 'ready',     label: 'Готова продукція' },
  { id: 'operative', label: 'Оперативний' },
]

const STATUS_COLORS: Record<string, string> = {
  ok:       'var(--green)',
  low:      'var(--yellow)',
  critical: 'var(--red)',
}

export function Warehouse() {
  const [items, setItems] = useState<StockItem[]>([])
  const [tab, setTab]     = useState<Tab>('main')

  useEffect(() => { api.stock().then(setItems) }, [])

  const visible = items.filter(i => i.category === tab)

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-shrink-0 font-mono text-[11px] tracking-wider px-4 py-2 rounded-full border transition-all cursor-pointer"
            style={{
              background:   tab === t.id ? 'var(--orange-dim)' : 'var(--surface)',
              borderColor:  tab === t.id ? 'var(--orange)'     : 'var(--border)',
              color:        tab === t.id ? 'var(--orange)'     : 'var(--text-dim)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {items.length === 0 && <Spinner />}

      {visible.length === 0 && items.length > 0 && (
        <div className="text-center py-16 text-[var(--text-dim)]">
          <div className="text-5xl mb-3">📦</div>
          <p className="text-sm">Порожньо</p>
        </div>
      )}

      {visible.length > 0 && (
        <>
          <SectionTitle>
            {tab === 'main' ? 'Сировина та матеріали' : tab === 'ready' ? 'Готова продукція' : 'Оперативний склад'}
          </SectionTitle>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {visible.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center px-4 py-3 gap-3 active:bg-surface2 transition-colors cursor-pointer"
                style={{ borderBottom: idx < visible.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{item.name}</div>
                  <div className="font-mono text-[10px] text-[var(--text-dim)] mt-0.5">{item.sku}</div>
                </div>
                <div className="font-display text-xl min-w-[44px] text-right"
                     style={{ color: STATUS_COLORS[item.status] }}>
                  {item.qty}
                </div>
                <div className="font-mono text-[10px] text-[var(--text-dim)] min-w-[24px]">
                  {item.unit}
                </div>
                <StatusDot status={item.status} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  return (
    <div className="w-2 h-2 rounded-full flex-shrink-0"
         style={{ background: STATUS_COLORS[status] ?? 'var(--border)' }} />
  )
}
