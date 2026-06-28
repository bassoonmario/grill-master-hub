import { EmptyState } from 'bbq-factory-os'
import { Package, AlertTriangle } from 'lucide-react'

export const WithIcon = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <EmptyState icon={<Package className="w-8 h-8" />} text="Склад порожній" />
  </div>
)

export const WithoutIcon = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <EmptyState text="Нічого не знайдено" />
  </div>
)

export const CustomText = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <EmptyState icon={<AlertTriangle className="w-8 h-8" />} text="Немає активних замовлень" />
  </div>
)
