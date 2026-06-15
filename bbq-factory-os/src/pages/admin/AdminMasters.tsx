import { SectionTitle, Card } from '@/components/UI'

export function AdminMasters() {
  return (
    <div className="space-y-4">
      <SectionTitle>Управління майстрами</SectionTitle>
      <Card className="bg-[#121212] border border-white/10 p-6">
        <p className="text-[var(--text-dim)] font-mono text-xs uppercase tracking-wide">
          Тут буде список персоналу та розрахунок зарплат.
        </p>
      </Card>
    </div>
  )
}
