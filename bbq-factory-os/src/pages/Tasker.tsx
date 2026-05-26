import { useEffect, useState } from 'react'
import { api, TaskerCard } from '@/lib/api'
import { SectionTitle, StatusTag, Spinner } from '@/components/UI'

export function Tasker() {
  const [cards, setCards] = useState<TaskerCard[]>([])

  useEffect(() => { api.taskerCards().then(setCards) }, [])

  const toggleItem = (cardId: number, itemId: number) => {
    setCards(prev => prev.map(c =>
      c.id !== cardId ? c : {
        ...c,
        items: c.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i)
      }
    ))
  }

  const confirm = async (cardId: number) => {
    await api.confirmTasker(cardId)
    setCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, status: 'done' as const } : c
    ))
  }

  const newCount = cards.filter(c => c.status === 'new' || c.status === 'progress').length

  return (
    <div>
      <SectionTitle>
        Вхідні доручення {newCount > 0 && <span className="text-[var(--orange)]">({newCount} активних)</span>}
      </SectionTitle>

      {cards.length === 0 && <Spinner />}

      <div className="flex flex-col gap-3">
        {cards.map(card => (
          <TaskerCardView
            key={card.id}
            card={card}
            onToggle={itemId => toggleItem(card.id, itemId)}
            onConfirm={() => confirm(card.id)}
          />
        ))}
      </div>
    </div>
  )
}

function TaskerCardView({
  card, onToggle, onConfirm
}: {
  card: TaskerCard
  onToggle: (id: number) => void
  onConfirm: () => void
}) {
  const allChecked = card.items.every(i => i.checked)
  const isDone     = card.status === 'done'

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden"
         style={{ opacity: isDone ? 0.7 : 1 }}>
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-border">
        <div>
          <div className="text-sm font-semibold">{card.title}</div>
          <div className="font-mono text-[10px] text-[var(--text-dim)] mt-0.5">
            від: {card.from} • {card.created_at}
          </div>
        </div>
        <StatusTag type={card.status} />
      </div>

      {/* Items */}
      <div className="px-4 py-3 flex flex-col gap-2.5">
        {card.items.map(item => (
          <div
            key={item.id}
            onClick={() => !isDone && onToggle(item.id)}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all text-[11px]
              ${item.checked
                ? 'bg-[var(--green)] border-[var(--green)] text-black font-bold'
                : 'border-border bg-transparent'
              }`}
            >
              {item.checked ? '✓' : ''}
            </div>
            <span className="text-[13px] flex-1"
                  style={{ textDecoration: item.checked ? 'line-through' : 'none',
                           color: item.checked ? 'var(--text-dim)' : 'var(--text)' }}>
              {item.name}
            </span>
            <span className="font-mono text-[12px] text-[var(--text-dim)]">
              {item.qty} {item.unit}
            </span>
          </div>
        ))}
      </div>

      {/* Confirm button */}
      {!isDone && (
        <div className="px-4 pb-4">
          <button
            onClick={onConfirm}
            disabled={!allChecked}
            className="w-full font-display text-lg tracking-[2px] py-3 rounded-lg border transition-all active:scale-[0.98] disabled:opacity-40"
            style={{
              background:   allChecked ? 'var(--green-dim)' : 'transparent',
              borderColor:  'var(--green)',
              color:        'var(--green)',
              cursor:       allChecked ? 'pointer' : 'not-allowed',
            }}
          >
            {allChecked ? 'ПІДТВЕРДИТИ ВИКОНАННЯ' : `ВІДМІТИТИ ВСІ (${card.items.filter(i=>i.checked).length}/${card.items.length})`}
          </button>
        </div>
      )}
    </div>
  )
}
