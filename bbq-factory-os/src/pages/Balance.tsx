import { useEffect, useState, useCallback } from 'react'
import { api, StockItem } from '@/lib/api'
import { Spinner, Card } from '@/components/UI'
import { ChevronDown, ChevronUp, Box, Package, RefreshCw } from 'lucide-react'

interface UnifiedStock {
  sku: string
  name: string
  ready: number
  cases: number
  category: string
}

const CATEGORIES = [
  { id: 'standard', title: '📏 СТАНДАРТНІ ГРИЛІ', color: '#D4AF37' },
  { id: 'large',    title: '🚚 ВЕЛИКІ ГРИЛІ',    color: '#D4AF37' },
  { id: 'premium',  title: '👑 ПРЕМІУМ СЕРІЯ',   color: '#D4AF37' },
  { id: 'minibars', title: '🍸 МІНІ-БАРИ',       color: '#D4AF37' },
]

export function Balance() {
  const [unifiedItems, setUnifiedItems] = useState<UnifiedStock[]>([])
  const [loading, setLoading] = useState(true)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

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

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.stock()
      const filtered = data.filter(i => i.category === 'ready' || i.category === 'cases')
      
      const grouped = filtered.reduce((acc, item) => {
        // Очищаємо SKU від зайвих пробілів для точного мапінгу
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
    } catch (error) {
      console.error('Failed to fetch stock:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading && unifiedItems.length === 0) return (
    <div className="h-[60vh] flex items-center justify-center"><Spinner /></div>
  )

  return (
    <div className="pb-24 px-4 pt-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl text-white uppercase tracking-tight">Залишки на складі</h1>
        <button 
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/70 text-xs py-2 px-4 rounded-full border border-white/10 transition-all active:scale-95"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Оновлення...' : 'Оновити'}
        </button>
      </div>

      <div className="space-y-4">
        {CATEGORIES.map(cat => {
          const catItems = unifiedItems.filter(i => i.category === cat.id)
          const isOpen = !!openGroups[cat.id]

          return (
            <div key={cat.id} className="border border-white/5 rounded-2xl overflow-hidden bg-black/40 backdrop-blur-md">
              <button 
                onClick={() => toggleGroup(cat.id)}
                className="w-full p-4 flex items-center justify-between bg-white/[0.02] active:bg-white/[0.05] transition-colors"
              >
                <div className="flex flex-col items-start">
                  <span className="font-display text-lg tracking-wide" style={{ color: cat.color }}>
                    {cat.title}
                  </span>
                  <span className="text-[10px] text-white/40 uppercase font-mono">
                    Позицій: {catItems.length}
                  </span>
                </div>
                {isOpen ? <ChevronUp className="text-white/20" /> : <ChevronDown className="text-white/20" />}
              </button>

              {isOpen && (
                <div className="p-3 space-y-3 animate-in slide-in-from-top-2 duration-300">
                  {catItems.length === 0 ? (
                    <div className="text-center py-6 text-white/20 text-sm italic">Немає даних</div>
                  ) : (
                    catItems.sort((a,b) => a.sku.localeCompare(b.sku)).map(item => (
                      <Card key={item.sku} className="bg-white/[0.03] border-white/5">
                        <div className="p-3 flex items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white leading-tight uppercase mb-0.5">
                              {item.name.replace(/Гриль|Кейс/gi, '').trim()}
                            </span>
                            <span className="text-[10px] text-white/40 font-mono tracking-wider">
                              {item.sku}
                            </span>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-1 mb-0.5">
                                <Box className="w-3 h-3 text-orange-500/50" />
                                <span className={`text-lg font-display ${item.cases === 0 ? 'text-white/20' : 'text-white'}`}>
                                  {item.cases}
                                </span>
                              </div>
                              <span className="text-[8px] text-white/30 uppercase font-bold tracking-tighter">Кейси</span>
                            </div>

                            <div className="w-[1px] h-8 bg-white/5" />

                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-1 mb-0.5">
                                <Package className="w-3 h-3 text-green-500/50" />
                                <span className={`text-lg font-display ${item.ready === 0 ? 'text-white/20' : 'text-white'}`}>
                                  {item.ready}
                                </span>
                              </div>
                              <span className="text-[8px] text-white/30 uppercase font-bold tracking-tighter">Готові</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
