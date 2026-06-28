import { StatCard } from 'bbq-factory-os'
import { Flame, Package, AlertTriangle, Banknote } from 'lucide-react'

export const Orange = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <StatCard icon={<Flame className="w-5 h-5" />} value={42} label="Гриль-сесії сьогодні" accent="orange" />
  </div>
)

export const Green = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <StatCard icon={<Package className="w-5 h-5" />} value={128} label="Одиниць на складі" accent="green" />
  </div>
)

export const Yellow = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <StatCard icon={<AlertTriangle className="w-5 h-5" />} value={7} label="Очікують поповнення" accent="yellow" />
  </div>
)

export const Red = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <StatCard icon={<AlertTriangle className="w-5 h-5" />} value={3} label="Критичний запас" accent="red" />
  </div>
)

export const Wide = () => (
  <div style={{ padding: 16, background: 'var(--bg)', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
    <StatCard icon={<Banknote className="w-5 h-5" />} value="₴18 400" label="Виручка за місяць" accent="orange" wide />
  </div>
)
