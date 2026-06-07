import { useEffect, useState } from 'react'
import { api, Task } from '@/lib/api'
import { SectionTitle, StatusTag, Spinner } from '@/components/UI'
import { useAuth } from '@/context/AuthContext'

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const { user } = useAuth()

  useEffect(() => { api.tasks().then(setTasks) }, [])

  const done    = tasks.filter(t => t.status === 'done').length
  const total   = tasks.length

  return (
    <div>
      <SectionTitle>Завдання майстра — Цикл {12}</SectionTitle>

      {/* Summary */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-4 flex items-center justify-between">
        <div>
          <div className="font-display text-3xl text-[var(--orange)]">{done}/{total}</div>
          <div className="font-mono text-[11px] text-[var(--text-dim)] tracking-wide mt-0.5">завдань виконано</div>
        </div>
        <div className="w-16 h-16 relative">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none"
                    stroke="var(--orange)" strokeWidth="3"
                    strokeDasharray={`${total ? (done/total)*94 : 0} 94`}
                    strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-[var(--orange)]">
            {total ? Math.round((done/total)*100) : 0}%
          </div>
        </div>
      </div>

      {tasks.length === 0 && <Spinner />}

      <div className="flex flex-col gap-2.5">
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

function TaskRow({ task }: { task: Task }) {
  const pct = task.plan ? Math.round((task.fact / task.plan) * 100) : 0

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden active:bg-surface2 transition-colors cursor-pointer">
      <div className="flex items-center px-4 py-3 gap-3">
        <TaskDot status={task.status} />
        <div className="flex-1">
          <div className="text-sm font-medium">{task.name}</div>
          <div className="font-mono text-[11px] text-[var(--text-dim)] mt-0.5">{task.stage}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl"
               style={{ color: task.status === 'done' ? 'var(--green)' : task.status === 'active' ? 'var(--orange)' : 'var(--text-dim)' }}>
            {task.fact}/{task.plan}
          </div>
          <StatusTag type={task.status} />
        </div>
      </div>
      {/* Progress mini-bar */}
      <div className="h-0.5 bg-surface2">
        <div className="h-full transition-all duration-700"
             style={{
               width: `${pct}%`,
               background: task.status === 'done' ? 'var(--green)' : task.status === 'active' ? 'var(--orange)' : 'var(--border)'
             }} />
      </div>
    </div>
  )
}

function TaskDot({ status }: { status: string }) {
  const base = "w-2.5 h-2.5 rounded-full flex-shrink-0"
  if (status === 'done')   return <div className={`${base} bg-[var(--green)]`} />
  if (status === 'active') return <div className={`${base} bg-[var(--orange)] animate-blink`} />
  return <div className={`${base} bg-border`} />
}
