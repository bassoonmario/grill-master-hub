import { Tabs } from 'bbq-factory-os'
import { BarChart3, Package, Truck, Settings } from 'lucide-react'

const adminTabs = [
  { key: 'dashboard', label: 'Дашборд', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'warehouses', label: 'Склади', icon: <Package className="w-4 h-4" /> },
  { key: 'tasker', label: 'Таскер', icon: <Truck className="w-4 h-4" /> },
  { key: 'system', label: 'Система', icon: <Settings className="w-4 h-4" /> },
]

export const Pill = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <Tabs tabs={adminTabs} active="dashboard" onChange={() => {}} variant="pill" />
  </div>
)

export const Underline = () => (
  <div style={{ background: 'var(--surface)' }}>
    <Tabs
      tabs={[
        { key: 'stats', label: 'Статистика' },
        { key: 'shipments', label: 'Відправки' },
        { key: 'defects', label: 'Брак' },
        { key: 'balance', label: 'Баланс' },
      ]}
      active="stats"
      onChange={() => {}}
      variant="underline"
    />
  </div>
)

export const Chip = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <Tabs
      tabs={[
        { key: 'raw', label: 'Сировина' },
        { key: 'semi', label: 'Напівфабрикати' },
        { key: 'ready', label: 'Готові' },
        { key: 'packing', label: 'Пакування' },
      ]}
      active="semi"
      onChange={() => {}}
      variant="chip"
    />
  </div>
)
