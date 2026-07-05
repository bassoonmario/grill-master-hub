// ─── API BASE ─────────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL ??
  (typeof window !== 'undefined' && window.location.hostname === 'test.wowusik.duckdns.org'
    ? `${window.location.protocol}//api-test.wowusik.duckdns.org`
    : '')

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
  if (!res.ok) {
    let detail = `API error ${res.status}`
    try {
      const data = await res.json()
      if (typeof data?.detail === 'string') detail = data.detail
    } catch {}
    throw new Error(detail)
  }
  return res.json()
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
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
  tasks: { id: any; name: string; stage: string; status: 'done' | 'active' | 'pending'; fact: number; plan: number }[]
}

export interface StockItem {
  id: number
  sku: string
  name: string
  qty: number
  unit: string
  status: 'ok' | 'low' | 'critical'
  category: 'main' | 'ready' | 'operative' | 'cases' | 'cases_empty' | 'finished_main' | 'finished' | 'loot_box_operative' | 'loot_box_main'
  min_limit?: number
  unit_type?: string
  conversion_factor?: number
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

export interface MasterLog {
  id: number
  date: string
  item_code: string
  quantity: number
}

export interface Shipment {
  report_date: string
  category: 'Звичайні' | 'Гравіювання' | 'Туристичний' | 'Бар' | 'Ящик' | 'Самовивіз' | 'Пильник'
  article: string
  quantity: number
  extras: Record<string, number | string>
  pickup_time: string | null
  is_wholesale: boolean
  finished_main_qty: number
  finished_main_available: number
  is_written_off: boolean
  retroactive_total_qty: number
  retroactive_corrected_qty: number
}

export interface ShipmentSourceBody {
  report_date: string
  article: string
  finished_main_qty: number
  tid: number
}

export interface RetroactiveSourceBody {
  report_date: string
  article: string
  finished_main_qty: number
  tid: number
}

export interface MasterWholesaleItem {
  article: string
  qty: number
}

export interface WholesaleOrderItem {
  order_id: number
  article: string
  qty: number
  from_master: number
  from_warehouse: number
  from_scratch: number
}

export interface WholesaleComponentRow {
  item_id: string
  reserved: number
  available: number
}

export interface WholesaleSourceBody {
  article: string
  from_master: number
  from_warehouse: number
  from_scratch: number
}

export interface Defect {
  id: number
  sku: string
  item_type: string
  reason: string
  defect_date: string
  status: string
}

export interface GlobalStat {
  master_name: string
  earn_1_15: number
  earn_16_end: number
  total: number
}

export interface NotificationAlert {
  source: string
  item_id: string
  quantity: number
  limit_val: number
  is_internal?: boolean
  id?: string
  unit_type?: string
  conversion_factor?: number
}

export interface IncomingTask {
  id: number
  item_id: string
  target_qty: number
  actual_qty: number | null
  status: string
  created_at: string
  completed_at: string | null
  driver_comment: string | null
  admin_comment: string | null
  is_simple: boolean
}

export interface DriverTask {
  id: number
  item_id: string
  target_qty: number
  actual_qty: number
  status: string
  admin_comment: string | null
  driver_comment: string | null
  is_simple: boolean
  created_at: string
  completed_at?: string
  pcs_per_pack?: number
  packs_per_box?: number
  pcs_per_box?: number
  task_type?: string
  component_id?: number
  input_qty?: number
  unit_type?: string
  conversion_factor?: number
}

export interface ReplenishAlert {
  id: number
  item_id: string
  item_name: string
  quantity: number
  current_qty: number
  pcs_per_pack: number
  packs_per_box: number
}

export interface PackagingRules {
  pcs_per_pack: number
  packs_per_box: number
  pcs_per_box: number
}

export interface InventoryCheckResult {
  id: number
  item_id: string
  table_key: string
  system_qty: number
  actual_qty: number
  delta: number
  checked_at: string
}

export interface LatestCheck {
  item_id: string
  table_key: string
  delta: number
  checked_at: string
}

export interface ComponentItem {
  id: number
  name: string
  unit_type: string
  conversion_factor: number
}

export interface WriteoffLog {
  id: number
  dt_create: string
  session_id: string
  article: string
  component: string
  qty: number
  source: string
  operation: string
}

export interface RecipeGrillGroup {
  set_id: string
  components: { item_id: string; quantity: number }[]
}

export interface RecipeCaseGroup {
  case_sku: string
  components: { component_id: number; item_name: string; items_per_case: number }[]
}

export interface RecipeLootboxGroup {
  box_id: string
  components: { item_id: string; quantity: number }[]
}

export interface OfficeTask {
  id: number
  admin_comment: string | null
  status: string
  created_at: string
  completed_at: string | null
  created_by: string | null
}

export interface OfficeStockRow {
  item_id: string
  quantity: number
  min_qty: number
  last_delivery_date: string | null
}

// ─── API METHODS ─────────────────────────────────────────────────────────────
export const api = {

  dashboard: async (): Promise<DashboardData> => {
    const d = await get<any>('/api/dashboard')
    return {
      cycle_id: d.cycle ?? '-',
      plan_total: d.tasks?.reduce((s: number, t: any) => s + (t.plan ?? 0), 0) ?? 0,
      plan_done: d.tasks?.reduce((s: number, t: any) => s + (t.fact ?? 0), 0) ?? 0,
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
    const data = await get<any[]>('/api/stock')
    return data.map((item: any, index: number) => ({
      id: item.item_id || index,
      sku: String(item.item_id),
      name: item.name,
      qty: item.quantity,
      unit: 'од',
      status: item.status,
      category: item.category === 'finished' ? 'ready' : item.category,
      min_limit: item.min_limit,
      unit_type: item.unit_type,
      conversion_factor: item.conversion_factor,
    })) as StockItem[]
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
    post('/api/tasker/confirm', { id }),

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

  getItemsMain: (): Promise<string[]> =>
    get<string[]>('/api/items/main'),

  getItemsOperative: (): Promise<string[]> =>
    get<string[]>('/api/items/operative'),

  getItemsComponents: (): Promise<ComponentItem[]> =>
    get<ComponentItem[]>('/api/items/components'),

  getMasterLogs: (masterName: string): Promise<MasterLog[]> =>
    get<MasterLog[]>(`/api/master/logs?master_name=${encodeURIComponent(masterName)}`),

  updateMasterLog: (logId: number, quantity: number) =>
    fetch(`${BASE}/api/master/logs/${logId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
      },
      body: JSON.stringify({ quantity })
    }).then(res => { if (!res.ok) throw new Error(); return res.json(); }),

  deleteMasterLog: (logId: number) =>
    fetch(`${BASE}/api/master/logs/${logId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    }).then(res => { if (!res.ok) throw new Error(); return res.json(); }),

  getShipments: (): Promise<Shipment[]> =>
    get<Shipment[]>('/api/master/shipments'),

  getDefects: (): Promise<Defect[]> =>
    get<Defect[]>('/api/master/defects'),

  getMasterWholesale: (): Promise<MasterWholesaleItem[]> =>
    get<MasterWholesaleItem[]>('/api/master/wholesale'),

  setShipmentSource: (body: ShipmentSourceBody): Promise<{ status: string }> =>
    patch<{ status: string }>('/api/master/shipments/source', body),

  setShipmentRetroactiveSource: (body: RetroactiveSourceBody): Promise<{ status: string }> =>
    post<{ status: string }>('/api/master/shipments/retroactive-source', body),

  // ─── ADMIN API ──────────────────────────────────────────────────────────────
  getGlobalStats: (): Promise<GlobalStat[]> =>
    get<GlobalStat[]>('/api/admin/masters/global-stats'),

  getShipmentsAdmin: (): Promise<Shipment[]> =>
    get<Shipment[]>('/api/admin/shipments'),

  getWholesaleItems: (): Promise<WholesaleOrderItem[]> =>
    get<WholesaleOrderItem[]>('/api/admin/wholesale/items'),

  getWholesaleOverview: (): Promise<WholesaleComponentRow[]> =>
    get<WholesaleComponentRow[]>('/api/admin/wholesale-overview'),

  setWholesaleSource: (orderId: number, body: WholesaleSourceBody): Promise<{ status: string }> =>
    post<{ status: string }>(`/api/admin/wholesale/${orderId}/source`, body),

  getNotifications: (): Promise<NotificationAlert[]> =>
    get<NotificationAlert[]>('/api/notifications?role=admin'),

  createIncomingTask: (body: {
    task_type: 'supply' | 'internal' | 'simple'
    item_id?: string
    target_qty?: number
    admin_comment?: string
    pcs_per_pack?: number
    packs_per_box?: number
    pcs_per_box?: number
  }) => post<{ status: string; id: number }>('/api/tasks/incoming', body),

  getIncomingTasks: (statusFilter?: string): Promise<IncomingTask[]> =>
    get<IncomingTask[]>(`/api/admin/incoming-tasks${statusFilter ? `?status_filter=${statusFilter}` : ''}`),

  getPackagingRules: (itemId: string): Promise<PackagingRules> =>
    get<PackagingRules>(`/api/admin/packaging-rules/${encodeURIComponent(itemId)}`),

  updateIncomingTaskStatus: (taskId: number, status: string) =>
    patch<{ status: string }>(`/api/admin/incoming-tasks/${taskId}/status`, { status }),

  updateIncomingTask: (taskId: number, body: { item_id?: string; target_qty?: number; admin_comment?: string }): Promise<{ status: string }> =>
    patch<{ status: string }>(`/api/admin/incoming-tasks/${taskId}`, body),

  updateInventory: (tableKey: string, itemId: string, newQuantity: number) =>
    fetch(`${BASE}/api/admin/inventory`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
      },
      body: JSON.stringify({ table_key: tableKey, item_id: itemId, new_quantity: newQuantity })
    }).then(res => { if (!res.ok) throw new Error(); return res.json(); }),

  // ─── DRIVER API ─────────────────────────────────────────────────────────────
  getDriverTasks: (): Promise<DriverTask[]> =>
    get<DriverTask[]>('/api/driver/tasks'),

  getDriverTasksDone: (): Promise<DriverTask[]> =>
    get<DriverTask[]>('/api/driver/tasks/done'),

  deliverTask: (
    taskId: number,
    destination: 'main' | 'operative',
    qty: number,
    actualPcsPerPack?: number,
    actualPacksPerBox?: number,
  ) =>
    post<{ status: string; total_delivered: number; task_status: string }>(
      `/api/driver/tasks/${taskId}/deliver`,
      { task_id: taskId, destination, qty, actual_pcs_per_pack: actualPcsPerPack, actual_packs_per_box: actualPacksPerBox }
    ),

  completeSimpleTask: (taskId: number) =>
    post<{ status: string }>(`/api/tasks/incoming/${taskId}/complete`, {}),

  // ─── MASTER REPLENISH ────────────────────────────────────────────────────────
  getReplenishAlerts: (): Promise<ReplenishAlert[]> =>
    get<ReplenishAlert[]>('/api/master/replenish-alerts'),

  confirmReplenish: (alertId: number) =>
    post<{ status: string }>(`/api/master/replenish/${alertId}/confirm`, {}),

  replenishComponent: (component_id: number, input_value: number, warehouse?: string) =>
    post<{ success: boolean; added_qty: number; new_quantity: number }>(
      `/api/admin/components/${component_id}/replenish`,
      { input_value, warehouse }
    ),

  inventoryCheck: (item_id: string, table_key: string, actual_qty: number, note?: string): Promise<InventoryCheckResult> =>
    post<InventoryCheckResult>('/api/admin/inventory/check', { item_id, table_key, actual_qty, note }),

  getLatestChecks: (): Promise<LatestCheck[]> =>
    get<LatestCheck[]>('/api/admin/inventory/checks/latest'),

  getWriteoffLogs: (params?: { dateFrom?: string; dateTo?: string; operation?: string; search?: string }): Promise<WriteoffLog[]> => {
    const qs = new URLSearchParams()
    if (params?.dateFrom) qs.set('date_from', params.dateFrom)
    if (params?.dateTo) qs.set('date_to', params.dateTo)
    if (params?.operation) qs.set('operation', params.operation)
    if (params?.search) qs.set('search', params.search)
    const q = qs.toString()
    return get<WriteoffLog[]>(`/api/admin/writeoff-logs${q ? '?' + q : ''}`)
  },

  getCycle: (): Promise<{ cycle: string }> =>
    get<{ cycle: string }>('/api/cycle'),

  getRecipesGrills: (): Promise<RecipeGrillGroup[]> =>
    get<RecipeGrillGroup[]>('/api/admin/recipes/grills'),

  getRecipesCasesAdmin: (): Promise<RecipeCaseGroup[]> =>
    get<RecipeCaseGroup[]>('/api/admin/recipes/cases'),

  getRecipesLootbox: (): Promise<RecipeLootboxGroup[]> =>
    get<RecipeLootboxGroup[]>('/api/admin/recipes/lootbox'),

  patchRecipeCase: (case_sku: string, component_id: number, items_per_case: number) =>
    patch<{ updated: number }>('/api/admin/recipes/cases', { case_sku, component_id, items_per_case }),

  patchRecipeGrill: (set_id: string, item_id: string, quantity: number) =>
    patch<{ updated: number }>('/api/admin/recipes/grills', { set_id, item_id, quantity }),

  patchRecipeLootbox: (box_id: string, item_id: string, quantity: number) =>
    patch<{ updated: number }>('/api/admin/recipes/lootbox', { box_id, item_id, quantity }),

  // ─── OFFICE API ─────────────────────────────────────────────────────────────
  createOfficeTask: (admin_comment: string, created_by?: string) =>
    post<{ status: string; id: number }>('/api/office/tasks', { admin_comment, created_by }),

  getOfficeTasks: (): Promise<OfficeTask[]> =>
    get<OfficeTask[]>('/api/office/tasks'),

  getOfficePendingOrders: (): Promise<OfficeTask[]> =>
    get<OfficeTask[]>('/api/office/pending-orders'),

  getOfficeStock: (): Promise<OfficeStockRow[]> =>
    get<OfficeStockRow[]>('/api/office/stock'),

  updateOfficeStock: (item_id: string, new_quantity: number) =>
    patch<{ item_id: string; quantity: number }>('/api/office/stock', { item_id, new_quantity }),

  receiveOfficeStock: (task_id: number, items: { item_id: string; qty: number }[]) =>
    post<{ status: string }>('/api/office/stock/receive', { task_id, items }),
}
