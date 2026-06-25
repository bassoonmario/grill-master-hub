from fastapi import FastAPI, HTTPException, Request, status, BackgroundTasks, Body
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any, Literal
import asyncpg
import os
import httpx
from datetime import date
from dotenv import load_dotenv
import random
import calendar

load_dotenv()

N8N_COMPONENTS_WEBHOOK_URL = os.getenv(
    "N8N_COMPONENTS_WEBHOOK_URL",
    "http://localhost:5678/webhook/bot_workshop.cases_components"
)

async def notify_n8n_low_stock(component_name: str, supplier: str, quantity: float):
    payload = {
        "component_name": component_name,
        "supplier": supplier,
        "quantity": quantity,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(N8N_COMPONENTS_WEBHOOK_URL, json=payload)
            print(f"[n8n] Sent low-stock alert: {component_name} = {quantity}")
    except Exception as e:
        print(f"[n8n] Webhook failed (non-critical): {e}")

app = FastAPI(title="BBQ Factory OS API", version="1.0.0")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc.errors())},
    )

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

@app.on_event("shutdown")
async def shutdown():
    if pool:
        await pool.close()

def current_cycle() -> str:
    return "1-15" if date.today().day <= 15 else "16-кін"

def cycle_date_range():
    today = date.today()
    if today.day <= 15:
        return today.replace(day=1), today.replace(day=15)
    last_day = calendar.monthrange(today.year, today.month)[1]
    return today.replace(day=16), today.replace(day=last_day)

class UserOut(BaseModel):
    tid:           int
    name:          str
    role:          str
    can_replenish: bool = False

class RegisterBody(BaseModel):
    name:     str
    role:     str
    pin_code: str
    tid:      Optional[int] = None

class LoginBody(BaseModel):
    tid: int
    pin_code: str

class MasterTaskCreate(BaseModel):
    master_name: str
    case_sku: str
    quantity: float

class MasterTaskUpdate(BaseModel):
    id: Optional[int] = None
    quantity: float

class MasterWorkLogBody(BaseModel):
    master_name: str
    item_code: str
    quantity: float

class MasterLogUpdate(BaseModel):
    quantity: float

class IncomingTaskCreate(BaseModel):
    task_type: Literal['supply', 'internal', 'simple'] = 'supply'
    item_id: Optional[str] = None
    target_qty: Optional[int] = None
    admin_comment: Optional[str] = None
    pcs_per_pack: Optional[int] = None
    packs_per_box: Optional[int] = None
    pcs_per_box: Optional[int] = None

class IncomingTaskStatusUpdate(BaseModel):
    status: str

class InventoryUpdate(BaseModel):
    table_key: str
    item_id: str
    new_quantity: int

class TaskDelivery(BaseModel):
    task_id: int
    destination: str  # 'main' або 'operative'
    qty: int
    actual_pcs_per_pack: Optional[int] = None
    actual_packs_per_box: Optional[int] = None

class IncomingTaskUpdate(BaseModel):
    item_id: Optional[str] = None
    target_qty: Optional[int] = None
    admin_comment: Optional[str] = None

class WriteOffResult(BaseModel):
    success: bool
    written_off_count: int
    errors: list
    details: list

@app.get("/api/auth/users", response_model=List[UserOut])
async def get_users():
    p = await get_pool()
    rows = await p.fetch("SELECT tid, name, role FROM public.masters ORDER BY name")
    return [dict(r) for r in rows]

@app.post("/api/auth/register", response_model=UserOut)
async def register_user(body: RegisterBody):
    p = await get_pool()
    existing = await p.fetchrow("SELECT tid FROM public.masters WHERE name = $1", body.name)
    if existing:
        raise HTTPException(status_code=400, detail="Користувач з таким іменем вже існує")
    effective_tid = body.tid if body.tid else random.randint(100000, 999999)
    row = await p.fetchrow("""
        INSERT INTO public.masters (tid, name, role, pin_code)
        VALUES ($1, $2, $3, $4)
        RETURNING tid, name, role
    """, int(effective_tid), body.name, body.role, body.pin_code)
    return dict(row)

@app.post("/api/auth/login", response_model=UserOut)
async def login_user(body: LoginBody):
    p = await get_pool()
    row = await p.fetchrow("""
        SELECT tid, name, role, COALESCE(can_replenish, false) AS can_replenish
        FROM public.masters
        WHERE tid = $1 AND pin_code = $2
    """, body.tid, body.pin_code)
    if not row:
        raise HTTPException(status_code=401, detail="Невірний пін-код")
    return dict(row)

@app.get("/api/stock")
async def get_stock():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT item_id::text, item_name AS name, quantity::float,
                min_limit::float, NULL::text AS unit_type, NULL::float AS conversion_factor,
                CASE
                    WHEN min_limit IS NULL         THEN 'ok'
                    WHEN quantity <= 0             THEN 'critical'
                    WHEN quantity <= min_limit     THEN 'critical'
                    WHEN quantity <= min_limit*1.5 THEN 'low'
                    ELSE 'ok'
                END AS status, 'main' AS category
            FROM bot_workshop.inventory_main

            UNION ALL
            SELECT item_id::text, item_id::text AS name, quantity::float, NULL::float, NULL::text, NULL::float, 'ok' AS status, 'finished' AS category
            FROM bot_workshop.inventory_finished

            UNION ALL
            SELECT item_id::text, item_name, quantity::float, NULL::float, NULL::text, NULL::float, 'ok' AS status, 'operative' AS category
            FROM bot_workshop.inventory_operative

            UNION ALL
            SELECT id::text AS item_id, component_name AS name, quantity::float, min_threshold::float AS min_limit,
                unit_type, conversion_factor,
                CASE
                    WHEN min_threshold IS NULL         THEN 'ok'
                    WHEN quantity <= 0                 THEN 'critical'
                    WHEN quantity <= min_threshold     THEN 'critical'
                    WHEN quantity <= min_threshold*1.5 THEN 'low'
                    ELSE 'ok'
                END AS status, 'cases' AS category
            FROM bot_workshop.cases_components

            UNION ALL
            SELECT item_id::text, item_id::text AS name, quantity::float, min_limit::float, NULL::text, NULL::float, 'ok' AS status, 'cases_empty' AS category
            FROM bot_workshop.inventory_cases

            UNION ALL
            SELECT item_id::text, item_id::text AS name, quantity::float, NULL::float, NULL::text, NULL::float, 'ok' AS status, 'finished_main' AS category
            FROM bot_workshop.inventory_finished_main

            ORDER BY category, item_id
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error fetching GET /api/stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard")
async def get_dashboard():
    p = await get_pool()
    try:
        today = date.today()
        cycle_start, cycle_end = cycle_date_range()
        done_today = await p.fetchval("SELECT COALESCE(SUM(quantity),0) FROM bot_workshop.master_logs WHERE work_date=$1", today) or 0
        shipped_today = await p.fetchval("SELECT COALESCE(SUM(quantity),0) FROM bot_workshop.daily_shipments WHERE shipment_date=$1", today) or 0
        in_progress = await p.fetchval("SELECT COUNT(*) FROM bot_workshop.master_tasks WHERE status='in_progress'") or 0
        defects = await p.fetchval("SELECT COUNT(*) FROM bot_workshop.defects WHERE status!='fixed'") or 0
        salary_cycle = await p.fetchval("SELECT COALESCE(SUM(ml.quantity * mp.work_price),0) FROM bot_workshop.master_logs ml JOIN public.master_prices mp ON ml.item_code = mp.item_id WHERE ml.work_date BETWEEN $1 AND $2", cycle_start, cycle_end) or 0
        
        task_rows = await p.fetch("SELECT case_sku AS id, case_sku AS name, status AS stage, status, COALESCE(completed_quantity,0)::float AS fact, quantity::float AS plan FROM bot_workshop.master_tasks ORDER BY CASE status WHEN 'in_progress' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END LIMIT 10")
        tasks = [{**dict(r), 'status': 'active' if r['status']=='in_progress' else 'done' if r['status']=='done' else 'pending'} for r in task_rows]
        
        return {"cycle": current_cycle(), "done_today": float(done_today), "shipped_today": float(shipped_today), "in_progress": int(in_progress), "defects": int(defects), "salary_cycle": float(salary_cycle), "alerts": [], "tasks": tasks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tasks")
async def get_tasks():
    p = await get_pool()
    try:
        rows = await p.fetch("SELECT case_sku AS id, case_sku AS name, master_name, status, COALESCE(completed_quantity,0)::float AS fact, quantity::float AS plan FROM bot_workshop.master_tasks ORDER BY CASE status WHEN 'in_progress' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, master_name")
        return [{**dict(r), 'status': 'active' if r['status']=='in_progress' else 'done' if r['status']=='done' else 'pending'} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tasker")
async def get_tasker():
    p = await get_pool()
    try:
        cards = await p.fetch("SELECT id, description AS title, COALESCE(created_by,'Адмін') AS from_name, to_char(created_at,'DD.MM HH24:MI') AS created_at, status FROM public.driver_tasks WHERE status != 'archived' ORDER BY CASE status WHEN 'new' THEN 1 WHEN 'progress' THEN 2 ELSE 3 END, created_at DESC LIMIT 20")
        result = []
        for card in cards:
            items = await p.fetch("SELECT id, item_name AS name, quantity::float AS qty, COALESCE(unit,'шт') AS unit, is_completed AS checked FROM public.driver_tasks_items WHERE task_id=$1 ORDER BY id", card['id'])
            result.append({**dict(card), "items": [dict(i) for i in items]})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/salary")
async def get_salary():
    p = await get_pool()
    try:
        cycle_start, cycle_end = cycle_date_range()
        rows = await p.fetch("SELECT ml.master_name, ml.item_code, SUM(ml.quantity)::float AS quantity, mp.work_price::float, SUM(ml.quantity * mp.work_price)::float AS total FROM bot_workshop.master_logs ml JOIN public.master_prices mp ON ml.item_code = mp.item_id WHERE ml.work_date BETWEEN $1 AND $2 GROUP BY ml.master_name, ml.item_code, mp.work_price ORDER BY ml.master_name, total DESC", cycle_start, cycle_end)
        return {"cycle": current_cycle(), "cycle_start": cycle_start.strftime("%d.%m.%Y"), "cycle_end": cycle_end.strftime("%d.%m.%Y"), "grand_total": sum(r['total'] for r in rows), "rows": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/master/shipments")
async def get_shipments():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT report_date, category, article, quantity, 
                   extras, pickup_time, is_wholesale
            FROM bot_workshop.shipment_lists
            ORDER BY report_date DESC, id ASC
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/master/defects")
async def get_defects():
    p = await get_pool()
    try:
        rows = await p.fetch("SELECT * FROM bot_workshop.defects ORDER BY defect_date DESC LIMIT 50")
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/master/dashboard")
async def get_master_dashboard(master_name: str):
    p = await get_pool()
    try:
        potential = await p.fetchval("""
            SELECT COALESCE(SUM(t.quantity * p.work_price), 0)
            FROM bot_workshop.master_tasks t
            JOIN public.master_prices p ON t.case_sku = p.item_id
            WHERE t.master_name = $1 AND t.status != 'виконано'
        """, master_name) or 0

        cycle_start, cycle_end = cycle_date_range()
        current_earn = await p.fetchval("""
            SELECT COALESCE(SUM(l.quantity * p.work_price), 0)
            FROM bot_workshop.master_logs l
            JOIN public.master_prices p ON l.item_code = p.item_id
            WHERE l.master_name = $1 AND l.work_date BETWEEN $2 AND $3
        """, master_name, cycle_start, cycle_end) or 0

        tasks = await p.fetch("""
            SELECT t.id, t.case_sku, t.quantity, COALESCE(t.completed_quantity, 0) as completed,
                   CASE WHEN ic.quantity < ic.min_limit THEN true ELSE false END as is_priority
            FROM bot_workshop.master_tasks t
            LEFT JOIN bot_workshop.inventory_cases ic ON t.case_sku = ic.item_id
            WHERE t.master_name = $1 AND t.status != 'виконано'
            ORDER BY is_priority DESC, t.created_at ASC
        """, master_name)

        return {
            "potential_earnings": float(potential),
            "current_earnings": float(current_earn),
            "cycle": current_cycle(),
            "tasks": [dict(t) for t in tasks]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/master/tasks")
async def create_master_task(body: MasterTaskCreate, background_tasks: BackgroundTasks):
    p = await get_pool()
    try:
        new_id = await p.fetchval("""
            INSERT INTO bot_workshop.master_tasks (master_name, case_sku, quantity, status)
            VALUES ($1, $2, $3, 'in_progress')
            RETURNING id
        """, body.master_name, body.case_sku, body.quantity)
        
        recipe = await p.fetch("""
            SELECT component_id, items_per_case 
            FROM bot_workshop.recipes_cases 
            WHERE TRIM(case_sku) ILIKE TRIM($1)
        """, body.case_sku)
        
        for row in recipe:
            comp_state = await p.fetchrow("""
                SELECT component_name, quantity, min_threshold, supplier 
                FROM bot_workshop.cases_components WHERE id = $1
            """, row['component_id'])
            
            if comp_state:
                current_qty = float(comp_state['quantity'])
                min_threshold = float(comp_state['min_threshold'] or 0)
                items_needed = float(row['items_per_case']) * body.quantity
                
                if (current_qty - items_needed) < min_threshold:
                    background_tasks.add_task(
                        notify_n8n_low_stock,
                        comp_state['component_name'],
                        comp_state['supplier'] or "",
                        current_qty
                    )
                    
        return {"status": "created", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/master/tasks/{task_id}")
async def update_master_task(task_id: int, body: MasterTaskUpdate, background_tasks: BackgroundTasks):
    p = await get_pool()
    try:
        old_task = await p.fetchrow("SELECT quantity, case_sku FROM bot_workshop.master_tasks WHERE id = $1", task_id)
        if not old_task:
            raise HTTPException(status_code=404, detail="Task not found")
        old_qty = float(old_task['quantity'])
        diff = body.quantity - old_qty
        
        if diff > 0:
            recipe = await p.fetch("""
                SELECT component_id, items_per_case 
                FROM bot_workshop.recipes_cases 
                WHERE TRIM(case_sku) ILIKE TRIM($1)
            """, old_task['case_sku'])
            for row in recipe:
                comp_state = await p.fetchrow("SELECT component_name, quantity, min_threshold, supplier FROM bot_workshop.cases_components WHERE id = $1", row['component_id'])
                if comp_state:
                    current_qty = float(comp_state['quantity'])
                    min_threshold = float(comp_state['min_threshold'] or 0)
                    items_needed = float(row['items_per_case']) * diff
                    if (current_qty - items_needed) < min_threshold:
                        background_tasks.add_task(
                            notify_n8n_low_stock,
                            comp_state['component_name'],
                            comp_state['supplier'] or "",
                            current_qty
                        )
                        
        await p.execute("UPDATE bot_workshop.master_tasks SET quantity = $1 WHERE id = $2", body.quantity, task_id)
        return {"status": "updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/master/tasks/{task_id}")
async def delete_master_task(task_id: int):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                task = await conn.fetchrow("SELECT case_sku, completed_quantity FROM bot_workshop.master_tasks WHERE id = $1", task_id)
                if not task:
                    raise HTTPException(status_code=404, detail="Task not found")

                completed = float(task['completed_quantity'] or 0)
                if completed > 0:
                    recipe = await conn.fetch("SELECT component_id, items_per_case FROM bot_workshop.recipes_cases WHERE TRIM(case_sku) ILIKE TRIM($1)", task['case_sku'])
                    for row in recipe:
                        return_qty = float(row['items_per_case']) * completed
                        await conn.execute("UPDATE bot_workshop.cases_components SET quantity = quantity + $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2", return_qty, row['component_id'])
                    await conn.execute("UPDATE bot_workshop.inventory_cases SET quantity = GREATEST(0, quantity - $1), last_update = CURRENT_TIMESTAMP WHERE item_id = $2", completed, task['case_sku'])
                await conn.execute("DELETE FROM bot_workshop.master_tasks WHERE id = $1", task_id)
        return {"status": "deleted", "returned_components": completed > 0}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/master/logs/{log_id}")
async def update_master_log(log_id: int, body: MasterLogUpdate):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow("SELECT item_code, quantity, master_name FROM bot_workshop.master_logs WHERE id = $1", log_id)
                if not row:
                    raise HTTPException(status_code=404, detail="Log not found")
                old_qty = float(row['quantity'])
                diff = body.quantity - old_qty
                item_code = row['item_code']
                master_name = row['master_name']
                
                await conn.execute("UPDATE bot_workshop.inventory_cases SET quantity = quantity + $1, last_update = CURRENT_TIMESTAMP WHERE item_id = $2", diff, item_code)
                recipe = await conn.fetch("SELECT component_id, items_per_case FROM bot_workshop.recipes_cases WHERE TRIM(case_sku) ILIKE TRIM($1)", item_code)
                for r in recipe:
                    items_needed = float(r['items_per_case']) * diff
                    await conn.execute("UPDATE bot_workshop.cases_components SET quantity = quantity - $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2", items_needed, r['component_id'])
                
                task = await conn.fetchrow("SELECT id, quantity, completed_quantity FROM bot_workshop.master_tasks WHERE master_name = $1 AND case_sku = $2 AND status != 'виконано' ORDER BY created_at DESC LIMIT 1", master_name, item_code)
                if not task:
                    task = await conn.fetchrow("SELECT id, quantity, completed_quantity FROM bot_workshop.master_tasks WHERE master_name = $1 AND case_sku = $2 ORDER BY created_at DESC LIMIT 1", master_name, item_code)
                
                if task:
                    new_completed = float(task['completed_quantity'] or 0) + diff
                    new_status = 'виконано' if new_completed >= float(task['quantity']) else 'in_progress'
                    await conn.execute("UPDATE bot_workshop.master_tasks SET completed_quantity = $1, status = $2 WHERE id = $3", new_completed, new_status, task['id'])
                
                await conn.execute("UPDATE bot_workshop.master_logs SET quantity = $1 WHERE id = $2", body.quantity, log_id)
        return {"status": "updated", "diff": diff}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/master/logs")
async def log_master_work(body: MasterWorkLogBody):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                await conn.execute("INSERT INTO bot_workshop.master_logs (master_name, work_date, item_code, quantity) VALUES ($1, CURRENT_DATE, $2, $3)", body.master_name, body.item_code, body.quantity)
                task = await conn.fetchrow("SELECT id, quantity, completed_quantity FROM bot_workshop.master_tasks WHERE master_name = $1 AND case_sku = $2 AND status != 'виконано' ORDER BY created_at ASC LIMIT 1", body.master_name, body.item_code)
                if task:
                    new_completed = float(task['completed_quantity'] or 0) + float(body.quantity)
                    new_status = 'виконано' if new_completed >= float(task['quantity']) else 'in_progress'
                    await conn.execute("UPDATE bot_workshop.master_tasks SET completed_quantity = $1, status = $2 WHERE id = $3", new_completed, new_status, task['id'])
                await conn.execute("INSERT INTO bot_workshop.inventory_cases (item_id, quantity, last_update) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (item_id) DO UPDATE SET quantity = bot_workshop.inventory_cases.quantity + EXCLUDED.quantity, last_update = CURRENT_TIMESTAMP", body.item_code, body.quantity)
                recipe = await conn.fetch("SELECT component_id, items_per_case FROM bot_workshop.recipes_cases WHERE TRIM(case_sku) ILIKE TRIM($1)", body.item_code)
                for row in recipe:
                    comp_id = row['component_id']
                    items_needed = float(row['items_per_case'])
                    total_comp_diff = items_needed * body.quantity
                    await conn.execute("UPDATE bot_workshop.cases_components SET quantity = quantity - $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2", total_comp_diff, comp_id)
        return {"status": "logged", "item": body.item_code, "diff": body.quantity, "recipe_updated": len(recipe) > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/master/logs")
async def get_master_logs(master_name: str):
    p = await get_pool()
    try:
        rows = await p.fetch("SELECT id, work_date as date, item_code, quantity::float FROM bot_workshop.master_logs WHERE master_name = $1 ORDER BY work_date DESC, id DESC", master_name)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/master/logs/{log_id}")
async def delete_master_log(log_id: int):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                log = await conn.fetchrow("SELECT quantity, item_code, master_name FROM bot_workshop.master_logs WHERE id = $1", log_id)
                if not log:
                    raise HTTPException(status_code=404, detail="Log not found")
                old_qty = float(log['quantity'])
                item_code = log['item_code']
                master_name = log['master_name']
                diff = -old_qty 
                await conn.execute("UPDATE bot_workshop.inventory_cases SET quantity = GREATEST(0, quantity + $1), last_update = CURRENT_TIMESTAMP WHERE item_id = $2", diff, item_code)
                recipe = await conn.fetch("SELECT component_id, items_per_case FROM bot_workshop.recipes_cases WHERE TRIM(case_sku) ILIKE TRIM($1)", item_code)
                for r in recipe:
                    items_returned = float(r['items_per_case']) * old_qty
                    await conn.execute("UPDATE bot_workshop.cases_components SET quantity = quantity + $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2", items_returned, r['component_id'])
                task = await conn.fetchrow("SELECT id, quantity, completed_quantity FROM bot_workshop.master_tasks WHERE master_name = $1 AND case_sku = $2 AND status != 'виконано' ORDER BY created_at DESC LIMIT 1", master_name, item_code)
                if not task:
                    task = await conn.fetchrow("SELECT id, quantity, completed_quantity FROM bot_workshop.master_tasks WHERE master_name = $1 AND case_sku = $2 ORDER BY created_at DESC LIMIT 1", master_name, item_code)
                if task:
                    new_completed = float(task['completed_quantity'] or 0) - old_qty
                    new_status = 'in_progress' 
                    await conn.execute("UPDATE bot_workshop.master_tasks SET completed_quantity = GREATEST(0, $1), status = $2 WHERE id = $3", new_completed, new_status, task['id'])
                await conn.execute("DELETE FROM bot_workshop.master_logs WHERE id = $1", log_id)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/master/stats")
async def get_master_stats(master_name: str):
    p = await get_pool()
    try:
        current_year = date.today().year
        rows = await p.fetch("""
            SELECT 
                CASE WHEN EXTRACT(DAY FROM ml.work_date) <= 15 THEN '01-15' ELSE '16-кін' END as cycle,
                EXTRACT(MONTH FROM ml.work_date) as month,
                ml.item_code,
                SUM(ml.quantity)::float as total_qty,
                SUM(ml.quantity * p.work_price)::float as total_earn
            FROM bot_workshop.master_logs ml
            JOIN public.master_prices p ON ml.item_code = p.item_id
            WHERE ml.master_name = $1 AND EXTRACT(YEAR FROM ml.work_date) = $2
            GROUP BY month, cycle, ml.item_code
            ORDER BY month DESC, cycle DESC
        """, master_name, current_year)

        ua_months = ["", "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"]
        periods = {}
        for r in rows:
            period_key = f"{ua_months[int(r['month'])]} ({r['cycle']})"
            if period_key not in periods:
                periods[period_key] = {"earnings": 0, "models": []}
            periods[period_key]["earnings"] += r['total_earn']
            periods[period_key]["models"].append({"name": r['item_code'], "qty": r['total_qty']})
        return [{"period": k, **v} for k, v in periods.items()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/items")
async def get_items():
    p = await get_pool()
    try:
        rows = await p.fetch("SELECT DISTINCT item_id FROM public.master_prices ORDER BY item_id")
        return [r['item_id'] for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/masters/global-stats")
async def get_admin_global_stats():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT 
                ml.master_name,
                SUM(CASE WHEN EXTRACT(DAY FROM ml.work_date) <= 15 THEN ml.quantity * p.work_price ELSE 0 END)::float AS earn_1_15,
                SUM(CASE WHEN EXTRACT(DAY FROM ml.work_date) > 15 THEN ml.quantity * p.work_price ELSE 0 END)::float AS earn_16_end,
                SUM(ml.quantity * p.work_price)::float AS total
            FROM bot_workshop.master_logs ml
            JOIN public.master_prices p ON ml.item_code = p.item_id
            WHERE EXTRACT(MONTH FROM ml.work_date) = EXTRACT(MONTH FROM CURRENT_DATE)
              AND EXTRACT(YEAR FROM ml.work_date) = EXTRACT(YEAR FROM CURRENT_DATE)
            GROUP BY ml.master_name
            ORDER BY total DESC;
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/notifications")
async def get_notifications(role: Optional[str] = None):
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT 'inventory_main' AS source, item_id, quantity::float, min_limit::float AS limit_val, NULL::boolean AS is_internal, NULL::text AS id, NULL::text AS unit_type, NULL::float AS conversion_factor
            FROM bot_workshop.inventory_main
            WHERE min_limit IS NOT NULL AND quantity <= min_limit

            UNION ALL

            SELECT 'inventory_operative' AS source, item_id, quantity::float, min_limit::float AS limit_val, NULL::boolean AS is_internal, NULL::text AS id, NULL::text AS unit_type, NULL::float AS conversion_factor
            FROM bot_workshop.inventory_operative
            WHERE min_limit IS NOT NULL AND quantity <= min_limit

            UNION ALL

            SELECT 'cases_components' AS source, component_name AS item_id, quantity::float, min_threshold::float AS limit_val, is_internal, id::text, unit_type, conversion_factor
            FROM bot_workshop.cases_components
            WHERE min_threshold IS NOT NULL AND quantity <= min_threshold

            UNION ALL

            SELECT 'defects' AS source, sku AS item_id, 0 AS quantity, 0 AS limit_val, NULL::boolean AS is_internal, NULL::text AS id, NULL::text AS unit_type, NULL::float AS conversion_factor
            FROM bot_workshop.defects
            WHERE status != 'fixed'
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/incoming-tasks")
async def get_incoming_tasks(status_filter: Optional[str] = None):
    p = await get_pool()
    try:
        if status_filter and status_filter != 'all':
            rows = await p.fetch("""
                SELECT id, item_id, target_qty, actual_qty, status,
                       to_char(created_at, 'DD.MM.YY HH24:MI') AS created_at,
                       to_char(completed_at, 'DD.MM.YY HH24:MI') AS completed_at,
                       driver_comment, admin_comment, is_simple
                FROM bot_workshop.incoming_tasks
                WHERE status = $1
                ORDER BY created_at DESC
            """, status_filter)
        else:
            rows = await p.fetch("""
                SELECT id, item_id, target_qty, actual_qty, status,
                       to_char(created_at, 'DD.MM.YY HH24:MI') AS created_at,
                       to_char(completed_at, 'DD.MM.YY HH24:MI') AS completed_at,
                       driver_comment, admin_comment, is_simple
                FROM bot_workshop.incoming_tasks
                ORDER BY CASE status 
                    WHEN 'очікується' THEN 1 
                    WHEN 'в роботі' THEN 2 
                    ELSE 3 
                END, created_at DESC
            """)
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error in GET /api/admin/incoming-tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/packaging-rules/{item_id}")
async def get_packaging_rules(item_id: str):
    p = await get_pool()
    try:
        row = await p.fetchrow("""
            SELECT pcs_per_pack, packs_per_box, pcs_per_box
            FROM bot_workshop.packaging_rules
            WHERE item_id = $1
        """, item_id)
        if row:
            return {
                "pcs_per_pack": int(row['pcs_per_pack'] or 0),
                "packs_per_box": int(row['packs_per_box'] or 0),
                "pcs_per_box": int(row['pcs_per_box'] or 0),
            }
        return {"pcs_per_pack": 0, "packs_per_box": 0, "pcs_per_box": 0}
    except Exception as e:
        print(f"Error in GET /api/admin/packaging-rules: {e}")
        return {"pcs_per_pack": 0, "packs_per_box": 0, "pcs_per_box": 0}

@app.post("/api/tasks/incoming")
async def create_incoming_task(body: IncomingTaskCreate):
    p = await get_pool()
    try:
        is_simple = body.task_type == 'simple'
        effective_item_id = body.item_id or ''
        effective_qty = body.target_qty or 0

        new_id = await p.fetchval("""
            INSERT INTO bot_workshop.incoming_tasks (item_id, target_qty, status, admin_comment, is_simple, task_type)
            VALUES ($1, $2, 'очікується', $3, $4, $5)
            RETURNING id
        """, effective_item_id, effective_qty, body.admin_comment, is_simple, body.task_type)

        if not is_simple and body.item_id and (body.pcs_per_pack or body.packs_per_box or body.pcs_per_box):
            pcs = body.pcs_per_pack or 0
            packs = body.packs_per_box or 0
            pcs_box = body.pcs_per_box or 0
            if pcs > 0 or packs > 0 or pcs_box > 0:
                await p.execute("""
                    INSERT INTO bot_workshop.packaging_rules (item_id, pcs_per_pack, packs_per_box, pcs_per_box, updated_at)
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                    ON CONFLICT (item_id) DO UPDATE SET
                        pcs_per_pack = EXCLUDED.pcs_per_pack,
                        packs_per_box = EXCLUDED.packs_per_box,
                        pcs_per_box = EXCLUDED.pcs_per_box,
                        updated_at = CURRENT_TIMESTAMP
                """, body.item_id, pcs, packs, pcs_box)

        return {"status": "created", "id": new_id}
    except Exception as e:
        print(f"Error in POST /api/tasks/incoming: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/admin/incoming-tasks/{task_id}/status")
async def update_incoming_task_status(task_id: int, body: IncomingTaskStatusUpdate):
    p = await get_pool()
    try:
        valid_statuses = ('очікується', 'в роботі', 'прийнято', 'архів')
        if body.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {valid_statuses}")

        if body.status in ('прийнято', 'архів'):
            await p.execute("""
                UPDATE bot_workshop.incoming_tasks 
                SET status = $1, completed_at = CURRENT_TIMESTAMP 
                WHERE id = $2
            """, body.status, task_id)
        else:
            await p.execute("""
                UPDATE bot_workshop.incoming_tasks SET status = $1 WHERE id = $2
            """, body.status, task_id)
        return {"status": "updated"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in PATCH /api/admin/incoming-tasks/{task_id}/status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/admin/incoming-tasks/{task_id}")
async def update_incoming_task(task_id: int, body: IncomingTaskUpdate):
    p = await get_pool()
    try:
        existing = await p.fetchrow("SELECT * FROM bot_workshop.incoming_tasks WHERE id = $1", task_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Task not found")

        new_item_id = body.item_id if body.item_id is not None else existing['item_id']
        new_target_qty = body.target_qty if body.target_qty is not None else existing['target_qty']
        new_admin_comment = body.admin_comment if body.admin_comment is not None else existing['admin_comment']

        await p.execute("""
            UPDATE bot_workshop.incoming_tasks
            SET item_id = $1, target_qty = $2, admin_comment = $3
            WHERE id = $4
        """, new_item_id, new_target_qty, new_admin_comment, task_id)

        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/admin/inventory")
async def update_admin_inventory(body: InventoryUpdate):
    p = await get_pool()
    valid_tables = ('finished', 'operative', 'components', 'main', 'cases_empty', 'finished_main')
    if body.table_key not in valid_tables:
        raise HTTPException(status_code=400, detail="Invalid table_key")
        
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                old_qty = 0
                
                if body.table_key == 'finished':
                    row = await conn.fetchrow("SELECT quantity FROM bot_workshop.inventory_finished WHERE item_id = $1", body.item_id)
                    if row:
                        old_qty = int(row['quantity'] or 0)
                        await conn.execute("UPDATE bot_workshop.inventory_finished SET quantity = $1 WHERE item_id = $2", body.new_quantity, body.item_id)
                    else:
                        await conn.execute("INSERT INTO bot_workshop.inventory_finished (item_id, quantity) VALUES ($1, $2)", body.item_id, body.new_quantity)

                elif body.table_key == 'operative':
                    row = await conn.fetchrow("SELECT quantity FROM bot_workshop.inventory_operative WHERE item_id = $1", body.item_id)
                    if row:
                        old_qty = int(row['quantity'] or 0)
                        await conn.execute("UPDATE bot_workshop.inventory_operative SET quantity = $1 WHERE item_id = $2", body.new_quantity, body.item_id)
                    else:
                        await conn.execute("INSERT INTO bot_workshop.inventory_operative (item_id, item_name, quantity) VALUES ($1, $1, $2)", body.item_id, body.new_quantity)

                elif body.table_key == 'main':
                    row = await conn.fetchrow("SELECT quantity FROM bot_workshop.inventory_main WHERE item_id = $1", body.item_id)
                    if row:
                        old_qty = int(row['quantity'] or 0)
                        await conn.execute("UPDATE bot_workshop.inventory_main SET quantity = $1, last_update = CURRENT_TIMESTAMP WHERE item_id = $2", body.new_quantity, body.item_id)
                    else:
                        await conn.execute("INSERT INTO bot_workshop.inventory_main (item_id, item_name, quantity, last_update) VALUES ($1, $1, $2, CURRENT_TIMESTAMP)", body.item_id, body.new_quantity)

                elif body.table_key == 'cases_empty':
                    row = await conn.fetchrow("SELECT quantity FROM bot_workshop.inventory_cases WHERE item_id = $1", body.item_id)
                    if row:
                        old_qty = int(row['quantity'] or 0)
                        await conn.execute("UPDATE bot_workshop.inventory_cases SET quantity = $1, last_update = CURRENT_TIMESTAMP WHERE item_id = $2", body.new_quantity, body.item_id)
                    else:
                        await conn.execute("INSERT INTO bot_workshop.inventory_cases (item_id, quantity, last_update) VALUES ($1, $2, CURRENT_TIMESTAMP)", body.item_id, body.new_quantity)

                elif body.table_key == 'finished_main':
                    row = await conn.fetchrow("SELECT quantity FROM bot_workshop.inventory_finished_main WHERE item_id = $1", body.item_id)
                    if row:
                        old_qty = int(row['quantity'] or 0)
                        await conn.execute("UPDATE bot_workshop.inventory_finished_main SET quantity = $1 WHERE item_id = $2", body.new_quantity, body.item_id)
                    else:
                        await conn.execute("INSERT INTO bot_workshop.inventory_finished_main (item_id, quantity) VALUES ($1, $2)", body.item_id, body.new_quantity)

                elif body.table_key == 'components':
                    row = await conn.fetchrow("SELECT quantity FROM bot_workshop.cases_components WHERE id = $1::int", body.item_id)
                    if row:
                        old_qty = int(row['quantity'] or 0)
                        await conn.execute("UPDATE bot_workshop.cases_components SET quantity = $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2::int", body.new_quantity, body.item_id)
                    else:
                        await conn.execute("INSERT INTO bot_workshop.cases_components (id, component_name, quantity, last_updated) VALUES ($1::int, 'Нова фурнітура', $2, CURRENT_TIMESTAMP)", body.item_id, body.new_quantity)

                delta = body.new_quantity - old_qty
                if delta != 0:
                    await conn.execute("""
                        INSERT INTO bot_workshop.history_logs (dt_create, item_id, change_qty, operation_type)
                        VALUES (CURRENT_TIMESTAMP, $1, $2, 'Ручне коригування адміна')
                    """, str(body.item_id), delta)
                    
        return {"status": "updated", "delta": delta}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in PATCH /api/admin/inventory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/components/{component_id}/replenish")
async def replenish_component(component_id: int, body: dict = Body(...)):
    input_value = float(body.get("input_value", 0))
    warehouse = body.get("warehouse")
    if input_value <= 0:
        raise HTTPException(status_code=400, detail="input_value must be > 0")
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                comp = await conn.fetchrow("""
                    SELECT component_name, unit_type, conversion_factor, is_internal
                    FROM bot_workshop.cases_components WHERE id = $1
                """, component_id)
                if not comp:
                    raise HTTPException(status_code=404, detail="Component not found")

                qty_to_add = round(input_value * float(comp["conversion_factor"] or 1))

                if warehouse and not comp["is_internal"]:
                    task_type = "supply" if warehouse == "main" else "internal"
                    await conn.execute("""
                        INSERT INTO bot_workshop.incoming_tasks
                        (item_id, target_qty, actual_qty, status, task_type, component_id, input_qty, unit_type, conversion_factor)
                        VALUES ($1, $2, 0, 'очікується', $3, $4, $5, $6, $7)
                    """, comp["component_name"], qty_to_add, task_type, component_id,
                        input_value, comp["unit_type"], comp["conversion_factor"])
                    return {"success": True, "mode": "task_created", "qty_to_add": qty_to_add}
                else:
                    await conn.execute("""
                        UPDATE bot_workshop.cases_components
                        SET quantity = quantity + $1, last_updated = CURRENT_TIMESTAMP
                        WHERE id = $2
                    """, qty_to_add, component_id)
                    await conn.execute("""
                        INSERT INTO bot_workshop.history_logs (dt_create, item_id, change_qty, operation_type)
                        VALUES (NOW() AT TIME ZONE 'Europe/Kyiv', $1, $2, 'replenish_component')
                    """, comp["component_name"], qty_to_add)
                    return {"success": True, "mode": "direct", "added_qty": qty_to_add}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in POST /api/admin/components/{component_id}/replenish: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/driver/tasks")
async def get_driver_tasks():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT it.id, it.item_id, it.target_qty, it.actual_qty, it.status,
                   it.admin_comment, it.driver_comment, it.is_simple, it.created_at,
                   it.task_type,
                   it.component_id, it.input_qty, it.unit_type, it.conversion_factor,
                   pr.pcs_per_pack, pr.packs_per_box, pr.pcs_per_box
            FROM bot_workshop.incoming_tasks it
            LEFT JOIN bot_workshop.packaging_rules pr ON pr.item_id = it.item_id
            WHERE it.status IN ('очікується', 'в роботі')
            ORDER BY it.created_at ASC
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/driver/tasks/{task_id}/deliver")
async def deliver_task(task_id: int, body: TaskDelivery):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                # Отримуємо дані таски (component_id для фурнітури)
                task_info = await conn.fetchrow("""
                    SELECT item_id, component_id FROM bot_workshop.incoming_tasks WHERE id = $1
                """, task_id)

                # Записуємо рядок доставки
                await conn.execute("""
                    INSERT INTO bot_workshop.task_deliveries
                        (task_id, item_id, destination, qty, delivered_at, actual_pcs_per_pack, actual_packs_per_box)
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
                """, task_id, task_info['item_id'], body.destination, body.qty, body.actual_pcs_per_pack, body.actual_packs_per_box)

                # Оновлюємо залишки у відповідній таблиці
                if task_info['component_id']:
                    await conn.execute("""
                        UPDATE bot_workshop.cases_components
                        SET quantity = quantity + $1, last_updated = CURRENT_TIMESTAMP
                        WHERE id = $2
                    """, body.qty, task_info['component_id'])
                    await conn.execute("""
                        INSERT INTO bot_workshop.history_logs (dt_create, item_id, change_qty, operation_type)
                        VALUES (NOW() AT TIME ZONE 'Europe/Kyiv', $1, $2, 'replenish_component')
                    """, task_info['item_id'], body.qty)
                elif body.destination == 'main':
                    await conn.execute("""
                        UPDATE bot_workshop.inventory_main
                        SET quantity = quantity + $1, last_update = CURRENT_TIMESTAMP
                        WHERE item_id = $2
                    """, body.qty, task_info['item_id'])
                elif body.destination == 'operative':
                    await conn.execute("""
                        UPDATE bot_workshop.inventory_operative
                        SET quantity = quantity + $1
                        WHERE item_id = $2
                    """, body.qty, task_info['item_id'])

                # Рахуємо суму всіх доставок по тасці
                total = await conn.fetchval("""
                    SELECT COALESCE(SUM(qty), 0) FROM bot_workshop.task_deliveries WHERE task_id = $1
                """, task_id)

                target = await conn.fetchval("""
                    SELECT target_qty FROM bot_workshop.incoming_tasks WHERE id = $1
                """, task_id)

                # Якщо сума доставок досягла планової кількості — закриваємо таску
                new_status = 'прийнято' if total >= target else 'в роботі'
                await conn.execute("""
                    UPDATE bot_workshop.incoming_tasks
                    SET actual_qty = $1, status = $2,
                        completed_at = CASE WHEN $2 = 'прийнято' THEN CURRENT_TIMESTAMP ELSE completed_at END
                    WHERE id = $3
                """, total, new_status, task_id)

        return {"status": "ok", "total_delivered": total, "task_status": new_status}
    except Exception as e:
        print(f"Error in deliver_task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/items/main")
async def get_items_main():
    p = await get_pool()
    try:
        rows = await p.fetch("SELECT DISTINCT item_id FROM bot_workshop.inventory_main ORDER BY item_id")
        return [r['item_id'] for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/items/operative")
async def get_items_operative():
    p = await get_pool()
    try:
        rows = await p.fetch("SELECT DISTINCT item_id FROM bot_workshop.inventory_operative ORDER BY item_id")
        return [r['item_id'] for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/items/components")
async def get_items_components():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT id, component_name AS name, COALESCE(unit_type, 'pcs') AS unit_type,
                   COALESCE(conversion_factor, 1)::float AS conversion_factor
            FROM bot_workshop.cases_components
            WHERE is_internal = false OR is_internal IS NULL
            ORDER BY component_name
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tasks/incoming/{task_id}/complete")
async def complete_simple_task(task_id: int):
    p = await get_pool()
    try:
        await p.execute("""
            UPDATE bot_workshop.incoming_tasks
            SET status = 'прийнято', completed_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND is_simple = true
        """, task_id)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/master/replenish-alerts")
async def get_replenish_alerts():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT ob.id, ob.item_id, ob.quantity,
                   COALESCE(io.item_name, ob.item_id) AS item_name,
                   io.quantity::int                    AS current_qty,
                   COALESCE(pr.pcs_per_pack, 1)::int  AS pcs_per_pack,
                   COALESCE(pr.packs_per_box, 0)::int AS packs_per_box
            FROM bot_workshop.operative_buffer ob
            LEFT JOIN bot_workshop.inventory_operative io ON io.item_id = ob.item_id
            LEFT JOIN bot_workshop.packaging_rules pr     ON pr.item_id = ob.item_id
            WHERE ob.status = 'pending'
            ORDER BY ob.created_at ASC
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error in GET /api/master/replenish-alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/master/replenish/{alert_id}/confirm")
async def confirm_replenish(alert_id: int):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow("""
                    UPDATE bot_workshop.operative_buffer
                    SET status = 'completed'
                    WHERE id = $1 AND status = 'pending'
                    RETURNING item_id, quantity
                """, alert_id)
                if not row:
                    raise HTTPException(status_code=404, detail="Алерт не знайдено або вже виконано")
                await conn.execute("""
                    UPDATE bot_workshop.inventory_operative
                    SET quantity = quantity + $1
                    WHERE item_id = $2
                """, row['quantity'], row['item_id'])
        return {"status": "ok", "item_id": row['item_id'], "added_qty": row['quantity']}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in POST /api/master/replenish/{alert_id}/confirm: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/driver/tasks/done")
async def get_driver_tasks_done():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT id, item_id, target_qty, actual_qty, status, admin_comment, 
                   driver_comment, is_simple, created_at, completed_at
            FROM bot_workshop.incoming_tasks
            WHERE status = 'прийнято'
            ORDER BY completed_at DESC
            LIMIT 50
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/write-off")
async def run_write_off(dry_run: bool = False):
    p = await get_pool()
    
    SKIP = {'ГРАВІЮВАННЯ ШАМПУРІВ', 'ЧОХОЛ'}
    DIRECT_OPERATIVE = {
        'ЧОХОЛ М': 'Чохол М',
        'ЧОХОЛ В': 'Чохол В', 
        'ПИЛЬНИК': 'ПИЛЬНИК',
        'ДОЩЕЧКА': 'дощечка',
    }
    
    details = []
    errors = []
    
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                # Отримуємо всі незаписані відправки
                shipments = await conn.fetch("""
                    SELECT id, article, quantity, is_case
                    FROM bot_workshop.daily_shipments
                    WHERE is_written_off = false
                    ORDER BY report_date, id
                """)
                
                if not shipments:
                    return {"success": True, "written_off_count": 0, "errors": [], "details": ["Немає записів для списання"]}
                
                for row in shipments:
                    s_id = row['id']
                    raw_article = row['article'].strip().upper()
                    qty = row['quantity']
                    is_case = row['is_case']
                    
                    # Нормалізація артикулу (кирилиця С → латиниця S)
                    article = raw_article
                    if len(raw_article) <= 5:  # G12, T1С, G17S — короткі
                        article = raw_article.replace('С', 'S')
                    
                    # 1. Пропускаємо послуги
                    if article in SKIP:
                        details.append(f"Пропущено (послуга): {article}")
                        continue
                    
                    # 2. Прямі позиції з inventory_operative
                    if article in DIRECT_OPERATIVE:
                        item_id = DIRECT_OPERATIVE[article]
                        await conn.execute("""
                            UPDATE bot_workshop.inventory_operative
                            SET quantity = quantity - $1
                            WHERE item_id = $2
                        """, qty, item_id)
                        await conn.execute("""
                            INSERT INTO bot_workshop.history_logs (dt_create, item_id, change_qty, operation_type)
                            VALUES (NOW() AT TIME ZONE 'Europe/Kyiv', $1, $2, 'write_off_direct')
                        """, item_id, -qty)
                        details.append(f"Списано {qty} з operative: {item_id}")
                        continue
                    
                    # 3. Визначаємо base_article (без H і T суфіксів, крім T1/T1S)
                    base_article = article
                    if not article.startswith('T1'):
                        base_article = article.replace('H', '').replace('T', '')
                    
                    # A. Перевіряємо inventory_finished
                    finished_row = await conn.fetchrow("""
                        SELECT quantity FROM bot_workshop.inventory_finished
                        WHERE item_id = $1
                    """, base_article)
                    finished_qty = finished_row['quantity'] if finished_row else 0
                    from_finished = min(finished_qty, qty)

                    if from_finished > 0:
                        await conn.execute("""
                            UPDATE bot_workshop.inventory_finished
                            SET quantity = quantity - $1
                            WHERE item_id = $2
                        """, from_finished, base_article)
                        await conn.execute("""
                            INSERT INTO bot_workshop.history_logs (dt_create, item_id, change_qty, operation_type)
                            VALUES (NOW() AT TIME ZONE 'Europe/Kyiv', $1, $2, 'write_off_finished')
                        """, base_article, -from_finished)
                        details.append(f"Списано {from_finished} з finished: {base_article}")

                    remaining = qty - from_finished

                    if remaining > 0:
                        if is_case:
                            # B. Кейс: inventory_cases (може йти в мінус) + recipes → inventory_operative
                            await conn.execute("""
                                UPDATE bot_workshop.inventory_cases
                                SET quantity = quantity - $1
                                WHERE item_id = $2
                            """, remaining, base_article)
                            recipe = await conn.fetch("""
                                SELECT item_id, quantity
                                FROM bot_workshop.recipes
                                WHERE UPPER(set_id) = $1
                            """, base_article)
                            for ing in recipe:
                                await conn.execute("""
                                    UPDATE bot_workshop.inventory_operative
                                    SET quantity = quantity - $1
                                    WHERE item_id = $2
                                """, ing['quantity'] * remaining, ing['item_id'])
                            await conn.execute("""
                                INSERT INTO bot_workshop.history_logs (dt_create, item_id, change_qty, operation_type)
                                VALUES (NOW() AT TIME ZONE 'Europe/Kyiv', $1, $2, 'write_off_case')
                            """, base_article, -remaining)
                            details.append(f"Списано {remaining} кейсів {base_article} (cases+operative)")
                        else:
                            # C. Не кейс: recipes → inventory_operative
                            recipe = await conn.fetch("""
                                SELECT item_id, quantity
                                FROM bot_workshop.recipes
                                WHERE UPPER(set_id) = $1
                            """, base_article)
                            if recipe:
                                for ing in recipe:
                                    await conn.execute("""
                                        UPDATE bot_workshop.inventory_operative
                                        SET quantity = quantity - $1
                                        WHERE item_id = $2
                                    """, ing['quantity'] * remaining, ing['item_id'])
                                await conn.execute("""
                                    INSERT INTO bot_workshop.history_logs (dt_create, item_id, change_qty, operation_type)
                                    VALUES (NOW() AT TIME ZONE 'Europe/Kyiv', $1, $2, 'write_off_box')
                                """, base_article, -remaining)
                                details.append(f"Списано {remaining} ящиків {base_article}")
                            else:
                                errors.append(f"Рецепт не знайдено: {base_article} (id={s_id})")
                
                # Позначаємо як списані
                if not dry_run:
                    await conn.execute("""
                        UPDATE bot_workshop.daily_shipments
                        SET is_written_off = true
                        WHERE is_written_off = false
                    """)
                else:
                    # dry_run — відкатуємо транзакцію
                    raise Exception("DRY_RUN")
                    
    except Exception as e:
        if str(e) == "DRY_RUN":
            return {"success": True, "dry_run": True, "written_off_count": len(details), "errors": errors, "details": details}
        errors.append(str(e))
        return {"success": False, "written_off_count": 0, "errors": errors, "details": details}
    
    return {"success": True, "written_off_count": len(details), "errors": errors, "details": details}        