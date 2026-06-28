import { AlertBanner } from 'bbq-factory-os'

export const Warning = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <AlertBanner text="Запас вугілля нижче мінімуму — поповніть найближчим часом" level="warning" />
  </div>
)

export const Critical = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <AlertBanner text="Арматура повністю вичерпана! Зупинено виробництво" level="critical" />
  </div>
)
