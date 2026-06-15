import { SectionTitle, Card } from '@/components/UI'

export function AdminSystem() {
  return (
    <div className="space-y-4">
      <SectionTitle>Системні налаштування</SectionTitle>
      <Card className="bg-[#121212] border border-white/10 p-6">
        <p className="text-[var(--text-dim)] font-mono text-xs uppercase tracking-wide">
          Тут буде реалізовано системні логи та налаштування.
        </p>
      </Card>
    </div>
  )
}
