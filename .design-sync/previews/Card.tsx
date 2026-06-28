import { Card, SectionTitle, StatusTag } from 'bbq-factory-os'

export const Default = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <Card>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', fontSize: 13 }}>
            Замовлення #1042
          </span>
          <StatusTag type="progress" />
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 12, fontFamily: 'monospace', margin: 0 }}>
          Гриль-набір Premium × 2 шт
        </p>
      </div>
    </Card>
  </div>
)

export const WithTitle = () => (
  <div style={{ padding: 16, background: 'var(--bg)' }}>
    <SectionTitle>Активні замовлення</SectionTitle>
    <Card>
      <div style={{ padding: 16 }}>
        <p style={{ color: 'var(--text)', fontFamily: 'monospace', fontSize: 13, margin: 0 }}>
          Warehouse #3 — поточний цикл 12
        </p>
      </div>
    </Card>
  </div>
)
