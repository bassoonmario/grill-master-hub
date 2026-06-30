import { useState, useEffect, useCallback } from 'react'
import { SectionTitle, Spinner, StatusTag, Tabs } from '@/components/UI'
import { api, IncomingTask, ComponentItem } from '@/lib/api'
import { Plus, ClipboardList, Archive, Send, Package, MessageSquare, AlertCircle, ChevronRight, CheckCircle2, Pencil, Check, X } from 'lucide-react'

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
  const [pcsPerBox, setPcsPerBox] = useState('')
  const [itemsList, setItemsList] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [packagingLoading, setPackagingLoading] = useState(false)

  const [componentsList, setComponentsList] = useState<ComponentItem[]>([])
  const [selectedComponent, setSelectedComponent] = useState<ComponentItem | null>(null)
  const [componentInputQty, setComponentInputQty] = useState('')
  const [componentWarehouse, setComponentWarehouse] = useState<'main' | 'operative'>('main')

  // Редагування карток у вкладці 'Активні'
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editItem, setEditItem] = useState('')
  const [editQty, setEditQty] = useState('')
  const [editComment, setEditComment] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

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

  const loadComponents = useCallback(async () => {
    try {
      const data = await api.getItemsComponents()
      setComponentsList(data || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

 useEffect(() => {
  loadItems()
  loadComponents()
  if (tab === 'active') {
    loadTasks()
  }
}, [tab, loadTasks, loadItems, loadComponents])

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
      setPcsPerBox(rules.pcs_per_box > 0 ? String(rules.pcs_per_box) : '')
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
    setPcsPerBox('')
    setSelectedComponent(null)
    setComponentInputQty('')
    setComponentWarehouse('main')
  }

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)

    if (selectedComponent) {
      if (!componentInputQty || parseFloat(componentInputQty) <= 0) {
        setError('Вкажіть коректну кількість')
        return
      }
      setIsSubmitting(true)
      try {
        await api.replenishComponent(selectedComponent.id, parseFloat(componentInputQty), componentWarehouse)
        setSuccess('Завдання для водія створено')
        resetForm()
        setTimeout(() => setSuccess(null), 3000)
      } catch (e) {
        console.error(e)
        setError('Помилка створення завдання')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

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
        pcs_per_box: pcsPerBox ? parseInt(pcsPerBox) : undefined,
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

  const startEdit = (task: IncomingTask) => {
    setEditingTaskId(task.id)
    setEditItem(task.item_id ?? '')
    setEditQty(task.target_qty != null ? String(task.target_qty) : '')
    setEditComment(task.admin_comment ?? '')
  }

  const cancelEdit = () => {
    setEditingTaskId(null)
    setEditItem('')
    setEditQty('')
    setEditComment('')
  }

  const handleSaveEdit = async (task: IncomingTask) => {
    setIsSavingEdit(true)
    try {
      const body: { item_id?: string; target_qty?: number; admin_comment?: string } = {}
      if (!task.is_simple) {
        if (editItem !== (task.item_id ?? '')) body.item_id = editItem
        if (editQty !== String(task.target_qty ?? '')) body.target_qty = parseInt(editQty) || 0
      }
      if (editComment !== (task.admin_comment ?? '')) body.admin_comment = editComment
      await api.updateIncomingTask(task.id, body)
      cancelEdit()
      loadTasks()
    } catch (e) {
      console.error(e)
      setError('Помилка збереження')
    } finally {
      setIsSavingEdit(false)
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
        <div className="p-4 rounded-xl flex items-center gap-3 text-sm font-mono border"
          style={{ background: 'var(--red-dim)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl flex items-center gap-3 text-sm font-mono border"
          style={{ background: 'var(--green-dim)', borderColor: 'var(--green)', color: 'var(--green)' }}>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={k => setTab(k as TabKey)} variant="underline" className="mb-0" />

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
                  onChange={e => { setSelectedItem(e.target.value); if (e.target.value) setSelectedComponent(null) }}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors appearance-none"
                >
                  <option value="">Оберіть артикул...</option>
                  {itemsList.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Фурнітура</label>
                <select
                  value={selectedComponent ? String(selectedComponent.id) : ''}
                  onChange={e => {
                    const comp = componentsList.find(c => String(c.id) === e.target.value) || null
                    setSelectedComponent(comp)
                    if (comp) setSelectedItem('')
                  }}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors appearance-none"
                >
                  <option value="">Оберіть фурнітуру...</option>
                  {componentsList.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </div>

              {!selectedComponent && (
                <>
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
                    <div className="grid grid-cols-3 gap-3">
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
                      <div>
                        <label className="text-[9px] font-mono text-white/20 uppercase block mb-1.5">шт/ящик</label>
                        <input
                          type="number"
                          value={pcsPerBox}
                          onChange={e => setPcsPerBox(e.target.value)}
                          placeholder="0"
                          className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-center text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedComponent && (
                <>
                  <div>
                    <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">Склад доставки</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setComponentWarehouse('main')}
                        className={`flex-1 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider border transition-all ${componentWarehouse === 'main' ? 'bg-[#c9963a]/15 text-[#c9963a] border-[#c9963a]/40' : 'bg-[#121212] text-white/40 border-white/10 hover:border-white/20'}`}
                      >
                        Основний
                      </button>
                      <button
                        onClick={() => setComponentWarehouse('operative')}
                        className={`flex-1 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider border transition-all ${componentWarehouse === 'operative' ? 'bg-[#c9963a]/15 text-[#c9963a] border-[#c9963a]/40' : 'bg-[#121212] text-white/40 border-white/10 hover:border-white/20'}`}
                      >
                        Майстерня
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">
                      Кількість ({({ pcs: 'шт', kg: 'кг', roll: 'мотки', strip: 'полоски' } as Record<string,string>)[selectedComponent.unit_type] || 'шт'})
                    </label>
                    <input
                      type="number"
                      value={componentInputQty}
                      onChange={e => setComponentInputQty(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors"
                    />
                    {componentInputQty && parseFloat(componentInputQty) > 0 && (
                      <p className="text-white/30 font-mono text-xs mt-1.5">
                        = {Math.round(parseFloat(componentInputQty) * selectedComponent.conversion_factor)} шт
                      </p>
                    )}
                  </div>
                </>
              )}
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
                tasks.filter(t => t.status !== 'архів' && t.status !== 'прийнято').map(task => (
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
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[9px] font-mono text-white/20">{task.created_at}</span>
                        <button
                          onClick={() => editingTaskId === task.id ? cancelEdit() : startEdit(task)}
                          className="p-1.5 rounded-lg bg-white/5 text-white/30 hover:text-[#c9963a] hover:bg-[#c9963a]/10 transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {task.driver_comment && (
                      <div className="bg-white/5 rounded-lg p-2.5">
                        <span className="text-[9px] font-mono text-white/30 uppercase block mb-1">Коментар водія</span>
                        <p className="text-white/60 font-mono text-xs break-words">{task.driver_comment}</p>
                      </div>
                    )}

                    {editingTaskId === task.id && (
                      <div className="space-y-3 pt-1 border-t border-white/5">
                        {!task.is_simple && (
                          <>
                            <div>
                              <label className="text-[9px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">Артикул</label>
                              <select
                                value={editItem}
                                onChange={e => setEditItem(e.target.value)}
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors appearance-none"
                              >
                                <option value="">Оберіть артикул...</option>
                                {itemsList.map(it => (
                                  <option key={it} value={it}>{it}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">Кількість</label>
                              <input
                                type="number"
                                value={editQty}
                                onChange={e => setEditQty(e.target.value)}
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors"
                              />
                            </div>
                          </>
                        )}
                        <div>
                          <label className="text-[9px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">
                            {task.is_simple ? 'Текст доручення' : 'Коментар адміна'}
                          </label>
                          <textarea
                            value={editComment}
                            onChange={e => setEditComment(e.target.value)}
                            rows={2}
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-white font-mono text-sm outline-none focus:border-[#c9963a]/50 transition-colors resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={cancelEdit}
                            className="flex-1 py-2 rounded-lg border border-white/10 text-white/40 font-mono text-[10px] uppercase tracking-wider hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <X className="w-3 h-3" /> Скасувати
                          </button>
                          <button
                            onClick={() => handleSaveEdit(task)}
                            disabled={isSavingEdit}
                            className="flex-[2] py-2 rounded-lg bg-[#c9963a]/15 border border-[#c9963a]/30 text-[#c9963a] font-mono text-[10px] uppercase tracking-wider hover:bg-[#c9963a]/25 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" /> Зберегти
                          </button>
                        </div>
                      </div>
                    )}
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
