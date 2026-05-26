from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
import asyncpg
import os
from datetime import date
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="BBQ Factory OS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pool: asyncpg.Pool = None

async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", 5432)),
            database=os.getenv("DB_NAME", "bbq_factory"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASS"),
            min_size=2,
            max_size=10,
        )
    return pool

@app.on_event("startup")
async def startup():
    await get_pool()
    print("✅ DB pool created")

@app.on_event("shutdown")
async def shutdown():
    if pool:
        await pool.close()

def current_cycle() -> str:
    return "1-15" if date.today().day <= 15 else "16-кін"

def cycle_date_range():
    import calendar
    today = date.today()
    if today.day <= 15:
        return today.replace(day=1), today.replace(day=15)
    last_day = calendar.monthrange(today.year, today.month)[1]
    return today.replace(day=16), today.replace(day=last_day)

# ─── HEALTH ───────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "ok", "app": "BBQ Factory OS API"}

@app.get("/health")
async def health():
    try:
        p = await get_pool()
        await p.fetchval("SELECT 1")
        return {"status": "ok", "db": "connected", "cycle": current_cycle()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── 1. СКЛАД ─────────────────────────────────────────────────────────────────
class StockItem(BaseModel):
    item_id:   str
    name:      str
    quantity:  float
    min_limit: Optional[float]
    status:    str
    category:  str

@app.get("/api/stock", response_model=List[StockItem])
async def get_stock():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT item_id::text, item_name AS name, quantity::float,
                min_limit::float,
                CASE
                    WHEN min_limit IS NULL         THEN 'ok'
                    WHEN quantity <= 0             THEN 'critical'
                    WHEN quantity <= min_limit     THEN 'critical'
                    WHEN quantity <= min_limit*1.5 THEN 'low'
                    ELSE 'ok'
                END AS status, 'main' AS category
            FROM bot_workshop.inventory_main
            UNION ALL
            SELECT item_id::text, item_id::text, quantity::float, NULL::float, 'ok', 'finished'
            FROM bot_workshop.inventory_finished
            UNION ALL
            SELECT item_id::text, item_name, quantity::float, NULL::float, 'ok', 'operative'
            FROM bot_workshop.inventory_operative
            UNION ALL
            SELECT item_id::text, item_id::text, quantity::float, min_limit::float,
                CASE
                    WHEN quantity <= 0             THEN 'critical'
                    WHEN quantity <= min_limit     THEN 'critical'
                    WHEN quantity <= min_limit*1.5 THEN 'low'
                    ELSE 'ok'
                END, 'cases'
            FROM bot_workshop.inventory_cases
            ORDER BY category, item_id
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── 2. ДАШБОРД ───────────────────────────────────────────────────────────────
class Alert(BaseModel):
    text:  str
    level: str

class TaskSummary(BaseModel):
    id:     Any
    name:   str
    stage:  str
    status: str
    fact:   float
    plan:   float

class DashboardData(BaseModel):
    cycle:         str
    done_today:    float
    shipped_today: float
    in_progress:   int
    defects:       int
    salary_cycle:  float
    alerts:        List[Alert]
    tasks:         List[TaskSummary]

@app.get("/api/dashboard", response_model=DashboardData)
async def get_dashboard():
    p = await get_pool()
    try:
        today = date.today()
        cycle_start, cycle_end = cycle_date_range()

        done_today = await p.fetchval(
            "SELECT COALESCE(SUM(quantity),0) FROM bot_workshop.master_logs WHERE work_date=$1", today) or 0

        shipped_today = await p.fetchval(
            "SELECT COALESCE(SUM(quantity),0) FROM bot_workshop.daily_shipments WHERE shipment_date=$1", today) or 0

        in_progress = await p.fetchval(
            "SELECT COUNT(*) FROM bot_workshop.master_tasks WHERE status='in_progress'") or 0

        defects = await p.fetchval(
            "SELECT COUNT(*) FROM bot_workshop.defects WHERE status!='fixed'") or 0

        salary_cycle = await p.fetchval("""
            SELECT COALESCE(SUM(ml.quantity * mp.work_price),0)
            FROM bot_workshop.master_logs ml
            JOIN public.master_prices mp ON ml.item_code = mp.item_id
            WHERE ml.work_date BETWEEN $1 AND $2
        """, cycle_start, cycle_end) or 0

        alert_rows = await p.fetch("""
            SELECT item_name, quantity, min_limit
            FROM bot_workshop.inventory_main
            WHERE min_limit IS NOT NULL AND quantity <= min_limit * 1.5
            ORDER BY (quantity / NULLIF(min_limit,0)) LIMIT 5
        """)
        alerts = [
            Alert(
                text=f"Малий залишок: {r['item_name']} — {r['quantity']} шт",
                level="critical" if r['quantity'] <= r['min_limit'] else "warning"
            ) for r in alert_rows
        ]

        task_rows = await p.fetch("""
            SELECT case_sku AS id, case_sku AS name, status AS stage, status,
                COALESCE(completed_quantity,0)::float AS fact, quantity::float AS plan
            FROM bot_workshop.master_tasks
            ORDER BY CASE status WHEN 'in_progress' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END
            LIMIT 10
        """)
        tasks = [
            TaskSummary(
                id=r['id'], name=r['name'], stage=r['stage'],
                status='active' if r['status']=='in_progress' else 'done' if r['status']=='done' else 'pending',
                fact=r['fact'], plan=r['plan']
            ) for r in task_rows
        ]

        return DashboardData(
            cycle=current_cycle(),
            done_today=float(done_today), shipped_today=float(shipped_today),
            in_progress=int(in_progress), defects=int(defects),
            salary_cycle=float(salary_cycle),
            alerts=alerts, tasks=tasks,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── 3. ЗАВДАННЯ МАЙСТРА ──────────────────────────────────────────────────────
class MasterTask(BaseModel):
    id:          Any
    name:        str
    master_name: str
    status:      str
    fact:        float
    plan:        float

@app.get("/api/tasks", response_model=List[MasterTask])
async def get_tasks():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT case_sku AS id, case_sku AS name, master_name, status,
                COALESCE(completed_quantity,0)::float AS fact, quantity::float AS plan
            FROM bot_workshop.master_tasks
            ORDER BY CASE status WHEN 'in_progress' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, master_name
        """)
        return [
            MasterTask(
                id=r['id'], name=r['name'], master_name=r['master_name'],
                status='active' if r['status']=='in_progress' else 'done' if r['status']=='done' else 'pending',
                fact=r['fact'], plan=r['plan']
            ) for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── 4. ТАСКЕР ────────────────────────────────────────────────────────────────
class TaskerItem(BaseModel):
    id:      int
    name:    str
    qty:     float
    unit:    str
    checked: bool

class TaskerCard(BaseModel):
    id:         int
    title:      str
    from_name:  str
    created_at: str
    status:     str
    items:      List[TaskerItem]

@app.get("/api/tasker", response_model=List[TaskerCard])
async def get_tasker():
    p = await get_pool()
    try:
        # driver_type замість description, немає created_by
        cards = await p.fetch("""
            SELECT
                id,
                COALESCE(driver_type, 'Завдання') AS title,
                'Адмін' AS from_name,
                to_char(created_at, 'DD.MM HH24:MI') AS created_at,
                status
            FROM public.driver_tasks
            ORDER BY
                CASE
                    WHEN status = 'в процесі' THEN 1
                    WHEN status = 'нове'       THEN 2
                    ELSE 3
                END,
                created_at DESC
            LIMIT 20
        """)
        result = []
        for card in cards:
            # item_id замість item_name, target_qty замість quantity, is_confirmed замість is_completed
            # JOIN на inventory_main щоб отримати назву за item_id
            items = await p.fetch("""
                SELECT
                    dti.id,
                    COALESCE(im.item_name, dti.item_id) AS name,
                    dti.target_qty::float AS qty,
                    'шт' AS unit,
                    dti.is_confirmed AS checked
                FROM public.driver_tasks_items dti
                LEFT JOIN bot_workshop.inventory_main im ON im.item_id::text = dti.item_id
                WHERE dti.task_id = $1
                ORDER BY dti.id
            """, card['id'])
            result.append(TaskerCard(
                id=card['id'],
                title=card['title'],
                from_name=card['from_name'],
                created_at=card['created_at'],
                status=card['status'],
                items=[TaskerItem(**dict(i)) for i in items],
            ))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ConfirmBody(BaseModel):
    id: int

@app.post("/api/tasker/confirm")
async def confirm_tasker(body: ConfirmBody):
    p = await get_pool()
    try:
        # використовуємо реальний статус з БД
        await p.execute(
            "UPDATE public.driver_tasks SET status='виконано', completed_at=NOW() WHERE id=$1",
            body.id
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── 5. ЗАРПЛАТА ──────────────────────────────────────────────────────────────
class SalaryRow(BaseModel):
    master_name: str
    item_code:   str
    quantity:    float
    work_price:  float
    total:       float

class SalaryData(BaseModel):
    cycle:       str
    cycle_start: str
    cycle_end:   str
    grand_total: float
    rows:        List[SalaryRow]

@app.get("/api/salary", response_model=SalaryData)
async def get_salary():
    p = await get_pool()
    try:
        cycle_start, cycle_end = cycle_date_range()
        rows = await p.fetch("""
            SELECT ml.master_name, ml.item_code,
                SUM(ml.quantity)::float AS quantity,
                mp.work_price::float,
                SUM(ml.quantity * mp.work_price)::float AS total
            FROM bot_workshop.master_logs ml
            JOIN public.master_prices mp ON ml.item_code = mp.item_id
            WHERE ml.work_date BETWEEN $1 AND $2
            GROUP BY ml.master_name, ml.item_code, mp.work_price
            ORDER BY ml.master_name, total DESC
        """, cycle_start, cycle_end)
        grand_total = sum(r['total'] for r in rows)
        return SalaryData(
            cycle=current_cycle(),
            cycle_start=cycle_start.strftime("%d.%m.%Y"),
            cycle_end=cycle_end.strftime("%d.%m.%Y"),
            grand_total=grand_total,
            rows=[SalaryRow(**dict(r)) for r in rows],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── 6. МАЙСТРИ ───────────────────────────────────────────────────────────────
class Master(BaseModel):
    tid:  Optional[int]
    name: str
    role: str

@app.get("/api/masters", response_model=List[Master])
async def get_masters():
    p = await get_pool()
    rows = await p.fetch("SELECT tid, name, role FROM public.masters ORDER BY name")
    return [dict(r) for r in rows]

# ─── 7. БРАК ──────────────────────────────────────────────────────────────────
class Defect(BaseModel):
    id:        Any
    sku:       str
    item_type: Optional[str]
    reason:    Optional[str]
    status:    str

@app.get("/api/defects", response_model=List[Defect])
async def get_defects():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT id, sku, item_type, reason, status
            FROM bot_workshop.defects ORDER BY id DESC LIMIT 50
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
