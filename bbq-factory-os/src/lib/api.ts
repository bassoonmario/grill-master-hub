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
  cycle_id: number
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
  tasks: { id: number; name: string; stage: string; status: 'done'|'active'|'pending'; fact: number; plan: number }[]
}

export interface StockItem {
  id: number
  sku: string
  name: string
  qty: number
  unit: string
  status: 'ok' | 'low' | 'critical'
  category: 'main' | 'ready' | 'operative'
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

// ─── DEMO DATA (замінити коментарі на get() виклики) ─────────────────────────
export const api = {

  dashboard: (): Promise<DashboardData> =>
    // TODO: return get<DashboardData>('/api/dashboard')
    Promise.resolve({
      cycle_id: 12, plan_total: 30, plan_done: 22, done_today: 22,
      shipped: 18, in_progress: 4, defects: 1,
      salary_base: 14200, salary_bonus: 2400, days_left: 7,
      alerts: [{ text: 'Малий залишок: Сталевий лист 2мм — 12 шт', level: 'critical' }],
      tasks: [
        { id:1, name:'BBQ Стандарт 60x40',  stage:'Зварювання',  status:'done',    fact:8, plan:8 },
        { id:2, name:'BBQ Преміум 80x50',   stage:'Шліфування',  status:'active',  fact:4, plan:6 },
        { id:3, name:'Мангал складний',      stage:'Фарбування',  status:'pending', fact:0, plan:6 },
      ]
    }),

  stock: (): Promise<StockItem[]> =>
    // TODO: return get<StockItem[]>('/api/stock')
    Promise.resolve([
      { id:1, sku:'MAT-001', name:'Сталевий лист 2мм',  qty:12,  unit:'шт',  status:'critical', category:'main' },
      { id:2, sku:'MAT-002', name:'Сталевий лист 3мм',  qty:84,  unit:'шт',  status:'ok',       category:'main' },
      { id:3, sku:'MAT-010', name:'Термостійка фарба',  qty:8,   unit:'кг',  status:'low',      category:'main' },
      { id:4, sku:'MAT-021', name:'Болти M8 x 30',      qty:320, unit:'шт',  status:'ok',       category:'main' },
      { id:5, sku:'MAT-033', name:'Електроди 3мм',      qty:15,  unit:'пач', status:'low',      category:'main' },
      { id:6, sku:'FIN-001', name:'BBQ Стандарт 60x40', qty:8,   unit:'шт',  status:'ok',       category:'ready' },
      { id:7, sku:'FIN-002', name:'BBQ Преміум 80x50',  qty:3,   unit:'шт',  status:'low',      category:'ready' },
      { id:8, sku:'FIN-005', name:'Мангал складний',    qty:11,  unit:'шт',  status:'ok',       category:'ready' },
    ]),

  tasks: (): Promise<Task[]> =>
    // TODO: return get<Task[]>('/api/tasks')
    Promise.resolve([
      { id:1, name:'Зварювання корпусів BBQ 60x40', stage:'Зварювання', status:'done',    fact:8, plan:8  },
      { id:2, name:'Шліфування BBQ Преміум',        stage:'Шліфування', status:'active',  fact:4, plan:6  },
      { id:3, name:'Фарбування партії',             stage:'Фарбування', status:'pending', fact:0, plan:12 },
      { id:4, name:'Складання мангалів',            stage:'Складання',  status:'pending', fact:0, plan:5  },
    ]),

  taskerCards: (): Promise<TaskerCard[]> =>
    // TODO: return get<TaskerCard[]>('/api/tasker')
    Promise.resolve([
      {
        id:1, title:'Відвантаження замовлення #847',
        from:'Адмін', created_at:'09:15', status:'new',
        items:[
          { id:1, name:'BBQ Стандарт 60x40', qty:3, unit:'шт', checked:true  },
          { id:2, name:'BBQ Преміум 80x50',  qty:2, unit:'шт', checked:false },
          { id:3, name:'Мангал складний',    qty:1, unit:'шт', checked:false },
        ]
      },
      {
        id:2, title:'Прийом матеріалів від постачальника',
        from:'Адмін', created_at:'вчора 17:40', status:'done',
        items:[
          { id:4, name:'Сталевий лист 3мм', qty:50,  unit:'шт', checked:true },
          { id:5, name:'Болти M8 x 30',     qty:200, unit:'шт', checked:true },
        ]
      }
    ]),

  salary: (): Promise<SalaryData> =>
    // TODO: return get<SalaryData>('/api/salary')
    Promise.resolve({
      total:16600, base:8000, piecework:6200,
      bonus:2400, penalty:200,
      plan_pct:73, days_left:7, cycle_id:12
    }),

  confirmTasker: (id: number) =>
    // TODO: return post('/api/tasker/confirm', { id })
    post('/api/tasker/confirm', { id }).catch(() => console.log('demo mode')),
}
