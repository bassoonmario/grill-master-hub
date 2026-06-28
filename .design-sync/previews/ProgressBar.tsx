import { ProgressBar } from 'bbq-factory-os'

export const High = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <ProgressBar pct={87} label="Виробнича ефективність" subleft="за сьогодні" subright="ціль 90%" />
  </div>
)

export const Mid = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <ProgressBar pct={54} label="Запас арматури" subleft="54 / 100 кг" subright="поповнити скоро" />
  </div>
)

export const Low = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <ProgressBar pct={12} label="Деревне вугілля" subleft="12 кг залишок" subright="критично" />
  </div>
)
