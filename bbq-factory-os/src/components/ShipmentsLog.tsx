import { useState, useEffect, useRef } from 'react'
import { api, Shipment } from '@/lib/api'
import { SectionTitle } from '@/components/UI'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

// Вова, Матей — тільки ці двоє бачать/використовують інлайн-контроль джерела.
// Не роль (Матей вже role='admin', Вова — role='master'), конкретні tid.
const SOURCE_OVERRIDE_TIDS = new Set([417930, 397956])

const SECTION_ORDER = [
  'Звичайні', 'Гравіювання', 'Туристичний', 'Бар', 'Ящик', 'Самовивіз',
]

const EXTRA_ORDER: Record<string, number> = {
  'горіх': 1, 'без лого': 2, 'х2': 3, 'чохол': 4,
  'шамп': 5, 'шамп 2 сторони': 6, 'грав кейс': 7, 'note': 8
}

const skuSortKey = (sku: string): number => {
  const match = sku.match(/^[GTМВ]*(\d+)/i)
  return match ? parseInt(match[1]) : 9999
}

const daysSince = (dateStr: string): number => {
  const d = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / 86400000)
}

type DayItem = {
  article: string
  quantity: number
  extras: Record<string, number | string>
  pickup_time: string | null
  finished_main_qty: number
  finished_main_available: number
  is_written_off: boolean
}

type DayData = {
  categories: Record<string, DayItem[]>
  total: number
  pilnykCount: number
}

function getGroupedShipments(shipments: Shipment[]): Record<string, DayData> {
  const grouped: Record<string, DayData> = {}

  shipments.forEach(s => {
    const date = s.report_date
    if (!grouped[date]) {
      grouped[date] = {
        categories: {},
        total: 0,
        pilnykCount: 0,
      }
    }
    const day = grouped[date]

    // Пильник — окремо в футер
    if (s.category === 'Пильник') {
      day.pilnykCount += s.quantity
      return
    }

    const catKey = s.category
    if (!day.categories[catKey]) day.categories[catKey] = []

    day.categories[catKey].push({
      article: s.article,
      quantity: s.quantity,
      extras: s.extras || {},
      pickup_time: s.pickup_time ?? null,
      finished_main_qty: s.finished_main_qty ?? 0,
      finished_main_available: s.finished_main_available ?? 0,
      is_written_off: s.is_written_off ?? false,
    })

    // Total — не рахуємо Ящик і Бар (як в n8n totalCount)
    if (!['Ящик', 'Бар'].includes(s.category)) {
      day.total += s.quantity
    }
  })

  return grouped
}

interface ShipmentsLogProps {
  shipments: Shipment[]
}

export function ShipmentsLog({ shipments }: ShipmentsLogProps) {
  const { user } = useAuth()
  const canOverrideSource = !!user && SOURCE_OVERRIDE_TIDS.has(user.tid)

  const [openDays, setOpenDays] = useState<Record<string, boolean>>({})
  const [overrideOpen, setOverrideOpen] = useState<Record<string, boolean>>({})
  const [localValues, setLocalValues] = useState<Record<string, number>>({})
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({})
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Ретроактивна корекція (вже списані лінії) — окремий стан від живого
  // тоглу вище, щоб два потоки не змішувались.
  const [retroOpen, setRetroOpen] = useState<Record<string, boolean>>({})
  const [retroValues, setRetroValues] = useState<Record<string, number>>({})
  const [retroStatus, setRetroStatus] = useState<Record<string, 'idle' | 'saving' | 'done' | 'error'>>({})

  const nonWholesale = shipments.filter(s => !s.is_wholesale)
  const groupedShipments = getGroupedShipments(nonWholesale)

  const applySource = (date: string, article: string, value: number) => {
    if (!user) return
    const key = `${date}:${article}`
    setLocalValues(prev => ({ ...prev, [key]: value }))
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(async () => {
      try {
        await api.setShipmentSource({ report_date: date, article, finished_main_qty: value, tid: user.tid })
        setSavedFlash(prev => ({ ...prev, [key]: true }))
        if (flashTimers.current[key]) clearTimeout(flashTimers.current[key])
        flashTimers.current[key] = setTimeout(() => {
          setSavedFlash(prev => ({ ...prev, [key]: false }))
        }, 1500)
      } catch {
        alert(`Помилка збереження джерела для ${article}`)
      }
    }, 400)
  }

  const submitRetroactive = async (date: string, article: string) => {
    if (!user) return
    const key = `${date}:${article}`
    const value = retroValues[key] ?? 0
    if (value <= 0) return
    setRetroStatus(prev => ({ ...prev, [key]: 'saving' }))
    try {
      await api.setShipmentRetroactiveSource({ report_date: date, article, finished_main_qty: value, tid: user.tid })
      setRetroStatus(prev => ({ ...prev, [key]: 'done' }))
    } catch (e) {
      setRetroStatus(prev => ({ ...prev, [key]: 'error' }))
      alert(`Помилка ретроактивної корекції для ${article}: ${e instanceof Error ? e.message : ''}`)
    }
  }

  useEffect(() => {
    if (nonWholesale.length === 0) return
    const sortedDates = [...new Set(nonWholesale.map(item => item.report_date))].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    )
    if (sortedDates[0]) {
      setOpenDays(prev => ({ [sortedDates[0]]: true, ...prev }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments])

  const toggleDay = (date: string) => {
    setOpenDays(prev => ({ ...prev, [date]: !prev[date] }))
  }

  return (
    <div className="space-y-3">
      <SectionTitle>Лог відправок готової продукції</SectionTitle>
      {Object.keys(groupedShipments).length === 0 ? (
        <p className="text-xs text-[var(--text-dim)] font-mono text-center py-8">Відправок не знайдено</p>
      ) : (
        Object.entries(groupedShipments)
          .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
          .map(([date, dayData]) => {
            const isOpen = !!openDays[date]
            const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('uk-UA', {
              day: 'numeric', month: 'long', year: 'numeric'
            })

            return (
              <div key={date} className="border border-white/5 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-md">
                <button
                  onClick={() => toggleDay(date)}
                  className="w-full p-4 flex items-center justify-between bg-white/[0.02] active:bg-white/[0.05] transition-colors"
                >
                  <span className="font-mono text-sm font-bold text-white tracking-wide">{formattedDate}</span>
                  {isOpen ? <ChevronUp className="text-white/20" /> : <ChevronDown className="text-white/20" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-3 space-y-4 bg-black/40 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">

                    {SECTION_ORDER.map(catName => {
                      const items = dayData.categories[catName]
                      if (!items || items.length === 0) return null

                      return (
                        <div key={catName}>
                          <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5 text-[#c9963a]">
                            {catName}
                          </p>
                          <ul className="space-y-[3px]">
                            {[...items]
                              .sort((a, b) => skuSortKey(a.article) - skuSortKey(b.article))
                              .map((item, idx) => {
                                const sortedExtras = Object.entries(item.extras)
                                  .filter(([, v]) => v && v !== 0)
                                  .sort((a, b) => (EXTRA_ORDER[a[0]] ?? 99) - (EXTRA_ORDER[b[0]] ?? 99))

                                const parts: string[] = sortedExtras.map(([k, v]) => {
                                  if (k === 'х2') return 'х2'
                                  if (k === 'note') return String(v)
                                  return `${v} ${k}`
                                })
                                if (item.pickup_time) parts.push(item.pickup_time)

                                const extrasStr = parts.length > 0 ? ` (${parts.join(', ')})` : ''

                                const overrideKey = `${date}:${item.article}`
                                const maxOverride = Math.min(item.quantity, item.finished_main_available)
                                const isOverrideActive = overrideOpen[overrideKey] ?? item.finished_main_qty > 0
                                const overrideValue = localValues[overrideKey] ?? item.finished_main_qty

                                return (
                                  <li key={idx} className="flex items-baseline gap-1.5 font-mono text-[13px] flex-wrap">
                                    <span className="text-white/30">•</span>
                                    <span className="text-white font-medium">{item.article}</span>
                                    <span className="text-white/40">—</span>
                                    <span className="text-[#4ade80] font-bold">{item.quantity}</span>
                                    {extrasStr && (
                                      <span className="text-white/50 text-[11px]">{extrasStr}</span>
                                    )}
                                    {canOverrideSource && (
                                      <span className="flex items-center gap-1 ml-auto">
                                        <span className="flex rounded border border-white/10 overflow-hidden">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOverrideOpen(prev => ({ ...prev, [overrideKey]: false }))
                                              applySource(date, item.article, 0)
                                            }}
                                            className={`text-[10px] px-1.5 py-0.5 transition-colors ${
                                              !isOverrideActive
                                                ? 'bg-[#c9963a]/20 text-[#c9963a]'
                                                : 'bg-white/5 text-white/40 hover:text-white/60'
                                            }`}
                                          >
                                            Авто
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setOverrideOpen(prev => ({ ...prev, [overrideKey]: true }))}
                                            className={`text-[10px] px-1.5 py-0.5 border-l border-white/10 transition-colors ${
                                              isOverrideActive
                                                ? 'bg-[#c9963a]/20 text-[#c9963a]'
                                                : 'bg-white/5 text-white/40 hover:text-white/60'
                                            }`}
                                          >
                                            Зі складу
                                          </button>
                                        </span>
                                        {isOverrideActive && (
                                          <input
                                            type="number"
                                            min={0}
                                            max={maxOverride}
                                            value={overrideValue}
                                            onChange={(e) => {
                                              const raw = Number(e.target.value)
                                              const clamped = Math.max(0, Math.min(raw, maxOverride))
                                              applySource(date, item.article, clamped)
                                            }}
                                            className="w-14 bg-white/5 border border-white/10 rounded px-1 text-[12px] text-white"
                                          />
                                        )}
                                        <span
                                          className={`text-[10px] text-emerald-400 transition-opacity duration-700 ${
                                            savedFlash[overrideKey] ? 'opacity-100' : 'opacity-0'
                                          }`}
                                        >
                                          ✓ Збережено
                                        </span>
                                      </span>
                                    )}
                                    {canOverrideSource && item.is_written_off && daysSince(date) <= 7 && (
                                      <span className="flex items-center gap-1 ml-2 pl-2 border-l border-white/10">
                                        {!retroOpen[overrideKey] ? (
                                          <button
                                            type="button"
                                            onClick={() => setRetroOpen(prev => ({ ...prev, [overrideKey]: true }))}
                                            className="text-[10px] px-1.5 py-0.5 rounded border bg-sky-500/10 border-sky-500/30 text-sky-300"
                                          >
                                            Виправити заднім числом
                                          </button>
                                        ) : (
                                          <>
                                            <input
                                              type="number"
                                              min={0}
                                              value={retroValues[overrideKey] ?? 0}
                                              onChange={(e) => {
                                                const raw = Math.max(0, Number(e.target.value))
                                                setRetroValues(prev => ({ ...prev, [overrideKey]: raw }))
                                              }}
                                              className="w-14 bg-white/5 border border-sky-500/30 rounded px-1 text-[12px] text-white"
                                            />
                                            <button
                                              type="button"
                                              disabled={retroStatus[overrideKey] === 'saving'}
                                              onClick={() => submitRetroactive(date, item.article)}
                                              className="text-[10px] px-1.5 py-0.5 rounded border bg-sky-500/20 border-sky-500/40 text-sky-300 disabled:opacity-50"
                                            >
                                              {retroStatus[overrideKey] === 'saving' ? '...' : 'OK'}
                                            </button>
                                            {retroStatus[overrideKey] === 'done' && (
                                              <span className="text-[10px] text-emerald-400">✓ виправлено</span>
                                            )}
                                          </>
                                        )}
                                      </span>
                                    )}
                                  </li>
                                )
                              })}
                          </ul>
                        </div>
                      )
                    })}

                    {/* Футер */}
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
  )
}
