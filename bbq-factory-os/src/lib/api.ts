// ─── API BASE ─────────────────────────────────────────────────────────────────
// Змінюй тільки цей рядок коли підключаєш реальний сервер
const BASE = import.meta.env.VITE_API_URL ?? ''

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface DashboardData {
  cycle_id: string
  plan_total: number
  plan_done: number
  done_today: number
  shipped: number
  in_progress: number
  defects: number
  salary_base: number
  salary_bonus: number
  days_left: number
  alerts: { text: string; level: 'warning' | 'critical' }[]
  tasks: { id: any; name: string; stage: string; status: 'done'|'active'|'pending'; fact: number; plan: number }[]
}

export interface StockItem {
  id: number
  sku: string
  name: string
  qty: number
  unit: string
  status: 'ok' | 'low' | 'critical'
  category: 'main' | 'ready' | 'operative' | 'cases'
}

export interface Task {
  id: number
  name: string
  stage: string
  status: 'done' | 'active' | 'pending'
  fact: number
  plan: number
}

export interface TaskerCard {
  id: number
  title: string
  from: string
  created_at: string
  status: 'new' | 'progress' | 'done'
  items: { id: number; name: string; qty: number; unit: string; checked: boolean }[]
}

export interface SalaryData {
  total: number
  base: number
  piecework: number
  bonus: number
  penalty: number
  plan_pct: number
  days_left: number
  cycle_id: number
}

export interface MasterDashboard {
  potential_earnings: number
  current_earnings: number
  cycle: string
  tasks: { 
    id: number
    case_sku: string
    quantity: number
    completed: number
    is_priority: boolean 
  }[]
}

export interface MasterStatPeriod {
  period: string
  earnings: number
  models: { name: string; qty: number }[]
}

// ─── DEMO DATA (замінити коментарі на get() виклики) ─────────────────────────
export const api = {

  dashboard: async (): Promise<DashboardData> => {
    const d = await get<any>('/api/dashboard')
    return {
      cycle_id: d.cycle ?? '-',
      plan_total: d.tasks?.reduce((s: number, t: any) => s + (t.plan ?? 0), 0) ?? 0,
      plan_done:  d.tasks?.reduce((s: number, t: any) => s + (t.fact ?? 0), 0) ?? 0,
      done_today: d.done_today ?? 0,
      shipped: d.shipped_today ?? 0,
      in_progress: d.in_progress ?? 0,
      defects: d.defects ?? 0,
      salary_base: d.salary_cycle ?? 0,
      salary_bonus: 0,
      days_left: 0,
      alerts: d.alerts ?? [],
      tasks: d.tasks ?? [],
    }
  },

  stock: async (): Promise<StockItem[]> => {
    const data = await get<any[]>('/api/stock');
    return data.map((item: any, index: number) => ({
      id: item.item_id || index,
      sku: String(item.item_id),
      name: item.name,
      qty: item.quantity,
      unit: 'од',
      status: item.status,
      category: item.category === 'finished' ? 'ready' : item.category
    })) as StockItem[];
  },

  tasks: async (): Promise<Task[]> => {
    const data = await get<any[]>('/api/tasks')
    return data.map((t: any) => ({
      id: t.id,
      name: t.name ?? t.case_sku ?? String(t.id),
      stage: t.master_name ?? t.stage ?? '-',
      status: t.status,
      fact: t.fact ?? 0,
      plan: t.plan ?? 0,
    })) as Task[]
  },

  taskerCards: async (): Promise<TaskerCard[]> => {
    const data = await get<any[]>('/api/tasker')
    return data.map((c: any) => ({
      id: c.id,
      title: c.title ?? c.driver_type ?? `Завдання #${c.id}`,
      from: c.from_name ?? c.from ?? 'Адмін',
      created_at: c.created_at ?? '',
      status: c.status === 'в процесі' ? 'progress' : c.status === 'виконано' ? 'done' : 'new',
      items: (c.items ?? []).map((i: any) => ({
        id: i.id,
        name: i.name ?? i.item_id ?? String(i.id),
        qty: i.qty ?? i.target_qty ?? 0,
        unit: i.unit ?? 'шт',
        checked: i.checked ?? i.is_confirmed ?? false,
      }))
    })) as TaskerCard[]
  },

  salary: async (): Promise<SalaryData> => {
    const d = await get<any>('/api/salary')
    const total = d.grand_total ?? 0
    return {
      total,
      base: 0,
      piecework: total,
      bonus: 0,
      penalty: 0,
      plan_pct: 0,
      days_left: 0,
      cycle_id: parseInt(d.cycle?.split('-')[0] ?? '0') || 0,
    }
  },

  confirmTasker: (id: number) =>
    // TODO: return post('/api/tasker/confirm', { id })
    post('/api/tasker/confirm', { id }).catch(() => console.log('demo mode')),

  // ─── MASTER CABINET API ─────────────────────────────────────────────────────
  
  getMasterDashboard: (masterName: string): Promise<MasterDashboard> =>
    get<MasterDashboard>(`/api/master/dashboard?master_name=${encodeURIComponent(masterName)}`),

  createMasterTask: (masterName: string, caseSku: string, quantity: number) =>
    post('/api/master/tasks', { master_name: masterName, case_sku: caseSku, quantity }),

  deleteMasterTask: (taskId: number) =>
    fetch(`${BASE}/api/master/tasks/${taskId}`, { 
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    }).then(res => { if (!res.ok) throw new Error(); return res.json(); }),

  logWork: (masterName: string, itemCode: string, quantity: number) =>
    post('/api/master/logs', { master_name: masterName, item_code: itemCode, quantity }),

  getMasterStats: (masterName: string): Promise<MasterStatPeriod[]> =>
    get<MasterStatPeriod[]>(`/api/master/stats?master_name=${encodeURIComponent(masterName)}`),

  getItems: (): Promise<string[]> =>
    get<string[]>('/api/items'),
}
