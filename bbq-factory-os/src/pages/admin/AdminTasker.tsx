import { useState, useEffect, useCallback } from 'react'
import { SectionTitle, Spinner, StatusTag } from '@/components/UI'
import { api, IncomingTask } from '@/lib/api'
import { Plus, ClipboardList, Archive, Send, Package, MessageSquare, AlertCircle, ChevronRight, CheckCircle2 } from 'lucide-react'

type TabKey = 'create' | 'active' | 'archive'
type TaskType = 'supply' | 'internal' | 'simple'

export function AdminTasker() {
  const [tab, setTab] = useState<TabKey>('create')
  const [tasks, setTasks] = useState<IncomingTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [taskType, setTaskType] = useState<TaskType>('supply')
  const [selectedItem, setSelectedItem] = useState('')
  const [targetQty, setTargetQty] = useState('')
  const [comment, setComment] = useState('')
  const [pcsPerPack, setPcsPerPack] = useState('')
  const [packsPerBox, setPacksPerBox] = useState('')
  const [itemsList, setItemsList] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [packagingLoading, setPackagingLoading] = useState(false)

  const loadTasks = useCallback(async (filter?: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getIncomingTasks(filter)
      setTasks(data || [])
    } catch (e) {
      console.error(e)
      setError('Помилка завантаження завдань')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadItems = useCallback(async (type: TaskType = taskType) => {
    try {
      let data: string[]
      if (type === 'internal') {
        data = await api.getItemsOperative()
      } else {
        data = await api.getItemsMain()
      }
      setItemsList(data || [])
    } catch (e) {
      console.error(e)
    }
  }, [taskType])

  useEffect(() => {
    if (tab === 'create') {
      loadItems()
    } else if (tab === 'active') {
      loadTasks()
    }
  }, [tab, taskType])
    }
  }, [tab, loadTasks, loadItems])

  const loadPackaging = useCallback(async (itemId: string) => {
    if (!itemId) {
      setPcsPerPack('')
      setPacksPerBox('')
      return
    }
    setPackagingLoading(true)
    try {
      const rules = await api.getPackagingRules(itemId)
      setPcsPerPack(rules.pcs_per_pack > 0 ? String(rules.pcs_per_pack) : '')
      setPacksPerBox(rules.packs_per_box > 0 ? String(rules.packs_per_box) : '')
    } catch (e) {
      console.error(e)
      setPcsPerPack('')
      setPacksPerBox('')
    } finally {
      setPackagingLoading(false)
    }
  }, [])

  useEffect(() => {
    if (taskType !== 'simple' && selectedItem) {
      loadPackaging(selectedItem)
    }
  }, [selectedItem, taskType, loadPackaging])

  const resetForm = () => {
    setSelectedItem('')
    setTargetQty('')
    setComment('')
    setPcsPerPack('')
    setPacksPerBox('')
  }

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)

    if (taskType === 'simple') {
      if (!comment.trim()) {
        setError('Введіть текст доручення')
        return
      }
    } else {
      if (!selectedItem) {
        setError('Оберіть артикул')
        return
      }
      if (!targetQty || parseInt(targetQty) <= 0) {
        setError('Вкажіть коректну кількість')
        return
      }
    }

    setIsSubmitting(true)
    try {
      await api.createIncomingTask({
        task_type: taskType,
        item_id: taskType === 'simple' ? undefined : selectedItem,
        target_qty: taskType === 'simple' ? undefined : parseInt(targetQty),
        admin_comment: comment || undefined,
        pcs_per_pack: pcsPerPack ? parseInt(pcsPerPack) : undefined,
        packs_per_box: packsPerBox ? parseInt(packsPerBox) : undefined,
      })
      setSuccess('Завдання створено')
      resetForm()
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      console.error(e)
      setError('Помилка створення завдання')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    setError(null)
    try {
      await api.updateIncomingTaskStatus(taskId, newStatus)
      if (tab === 'active') loadTasks()
      else if (tab === 'archive') loadTasks('архів')
    } catch (e) {
      console.error(e)
      setError('Помилка оновлення статусу')
    }
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'create', label: 'Створити', icon: <Plus className="w-4 h-4" /> },
    { key: 'active', label: 'Активні', icon: <ClipboardList className="w-4 h-4" /> },
    { key: 'archive', label: 'Архів', icon: <Archive className="w-4 h-4" /> },
  ]

  const taskTypeOptions: { key: TaskType; label: string; icon: React.ReactNode }[] = [
    { key: 'supply', label: 'Основний', icon: <Package className="w-4 h-4" /> },
    { key: 'internal', label: 'Майстерня', icon: <Send className="w-4 h-4" /> },
    { key: 'simple', label: 'Текстова', icon: <MessageSquare className="w-4 h-4" /> },
  ]

  const getTaskStatusTag = (status: string): 'new' | 'progress' | 'done' | 'pending' => {
    if (status === 'очікується') return 'new'
    if (status === 'в роботі') return 'progress'
    if (status === 'прийнято') return 'done'
    return 'pending'
  }

  return (
    <div className="space-y-6 pb-20">
      <SectionTitle>Логістичний Таскер</SectionTitle>

      {error && (
        <div className="bg-red-950/50 border border-red-900/50 text-red-200 p-4 rounded-xl flex items-center gap-3 text-sm font-mono shadow-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-950/50 border border-green-900/50 text-green-200 p-4 rounded-xl flex items-center gap-3 text-sm font-mono shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="flex gap-2 bg-[#0a0a0a] border border-white/5 rounded-xl p-1.5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-mono text-xs uppercase tracking-wider transition-all ${
              tab === t.key
                ? 'bg-[#c9963a]/20 text-[#c9963a] border border-[#c9963a]/30'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'create' && (
        <div className="space-y-5">
          <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">Тип завдання</div>
          <div className="flex gap-2">
            {taskTypeOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => { setTaskType(opt.key); resetForm() }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-xs uppercase tracking-wider transition-all border ${
                  taskType === opt.key
                    ? 'bg-[#c9963a]/15 text-[#c9963a] border-[#c9963a]/40'
                    : 'bg-[#121212] text-white/40 border-white/10 hover:border-white/20'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>

          {taskType !== 'simple' && (
            <>
              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Артикул</label>
                <select
                  value={selectedItem}
                  onChange={e => setSelectedItem(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors appearance-none"
                >
                  <option value="">Оберіть артикул...</option>
                  {itemsList.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Кількість</label>
                <input
                  type="number"
                  value={targetQty}
                  onChange={e => setTargetQty(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors"
                />
              </div>

              <div className="bg-[#0e0e0e] border border-white/5 rounded-xl p-4">
                <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Package className="w-3 h-3" />
                  Правила фасовки
                  {packagingLoading && <span className="text-[#c9963a] animate-pulse">завантаження...</span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-mono text-white/20 uppercase block mb-1.5">шт/пачка</label>
                    <input
                      type="number"
                      value={pcsPerPack}
                      onChange={e => setPcsPerPack(e.target.value)}
                      placeholder="0"
                      className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-center text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-white/20 uppercase block mb-1.5">пачок/ящик</label>
                    <input
                      type="number"
                      value={packsPerBox}
                      onChange={e => setPacksPerBox(e.target.value)}
                      placeholder="0"
                      className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-center text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">
              {taskType === 'simple' ? 'Текст доручення' : 'Коментар адміна'}
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={taskType === 'simple' ? 'Введіть текст завдання для Кума...' : 'Додаткові примітки (необов\'язково)'}
              rows={3}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-[#c9963a]/20 border border-[#c9963a]/40 text-[#c9963a] p-4 rounded-xl font-mono text-sm uppercase tracking-wider hover:bg-[#c9963a]/30 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Spinner /> : (
              <>
                <Plus className="w-4 h-4" />
                Створити завдання
              </>
            )}
          </button>
        </div>
      )}

      {tab === 'active' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <>
              {tasks.length === 0 ? (
                <div className="bg-[#121212] border border-white/10 rounded-xl p-6 text-center">
                  <p className="text-white/30 font-mono text-xs uppercase">Немає активних завдань</p>
                </div>
              ) : (
                tasks.filter(t => t.status !== 'архів').map(task => (
                  <div key={task.id} className="bg-[#121212] border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <StatusTag type={getTaskStatusTag(task.status)} />
                          {task.is_simple && (
                            <span className="text-[9px] font-mono text-white/20 uppercase bg-white/5 px-2 py-0.5 rounded">текстова</span>
                          )}
                        </div>
                        {task.item_id && task.item_id !== '' ? (
                          <p className="text-white font-mono text-sm">{task.item_id} — <span className="text-[#c9963a]">{task.target_qty} шт</span></p>
                        ) : null}
                        {task.admin_comment && (
                          <p className="text-white/50 font-mono text-xs mt-1 break-words">{task.admin_comment}</p>
                        )}
                      </div>
                      <span className="text-[9px] font-mono text-white/20 flex-shrink-0">{task.created_at}</span>
                    </div>

                    {task.driver_comment && (
                      <div className="bg-white/5 rounded-lg p-2.5">
                        <span className="text-[9px] font-mono text-white/30 uppercase block mb-1">Коментар водія</span>
                        <p className="text-white/60 font-mono text-xs break-words">{task.driver_comment}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {task.status === 'очікується' && (
                        <button
                          onClick={() => handleStatusChange(task.id, 'в роботі')}
                          className="flex-1 bg-[#c9963a]/10 border border-[#c9963a]/30 text-[#c9963a] py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider hover:bg-[#c9963a]/20 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <ChevronRight className="w-3 h-3" />
                          В роботу
                        </button>
                      )}
                      {(task.status === 'очікується' || task.status === 'в роботі') && (
                        <button
                          onClick={() => handleStatusChange(task.id, 'прийнято')}
                          className="flex-1 bg-green-900/10 border border-green-900/30 text-green-500 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider hover:bg-green-900/20 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Прийнято
                        </button>
                      )}
                      {task.status !== 'архів' && (
                        <button
                          onClick={() => handleStatusChange(task.id, 'архів')}
                          className="bg-white/5 border border-white/10 text-white/30 py-2 px-3 rounded-lg font-mono text-[10px] uppercase tracking-wider hover:bg-white/10 transition-colors"
                        >
                          <Archive className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}

      {tab === 'archive' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <>
              {tasks.length === 0 ? (
                <div className="bg-[#121212] border border-white/10 rounded-xl p-6 text-center">
                  <p className="text-white/30 font-mono text-xs uppercase">Архів порожній</p>
                </div>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className="bg-[#0e0e0e] border border-white/5 rounded-xl p-4 opacity-60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[9px] font-mono text-white/20 uppercase bg-white/5 px-2 py-0.5 rounded">архів</span>
                          {task.is_simple && (
                            <span className="text-[9px] font-mono text-white/15 uppercase bg-white/5 px-2 py-0.5 rounded">текстова</span>
                          )}
                        </div>
                        {task.item_id && task.item_id !== '' && (
                          <p className="text-white/50 font-mono text-xs">{task.item_id} — {task.target_qty} шт</p>
                        )}
                        {task.admin_comment && (
                          <p className="text-white/30 font-mono text-[11px] mt-1 break-words">{task.admin_comment}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span className="text-[9px] font-mono text-white/15">{task.created_at}</span>
                        {task.completed_at && (
                          <span className="text-[9px] font-mono text-green-900">{task.completed_at}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
