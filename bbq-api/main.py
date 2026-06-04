from fastapi import FastAPI, HTTPException, Request, status, BackgroundTasks
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
import asyncpg
import os
import httpx
from datetime import date
from dotenv import load_dotenv

load_dotenv()

N8N_COMPONENTS_WEBHOOK_URL = os.getenv(
    "N8N_COMPONENTS_WEBHOOK_URL",
    "http://localhost:5678/webhook/bot_workshop.cases_components"
)

async def notify_n8n_low_stock(component_name: str, supplier: str, quantity: float):
    """Відправляє POST запит на вебхук n8n при низьких залишках компонента."""
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
    import calendar
    today = date.today()
    if today.day <= 15:
        return today.replace(day=1), today.replace(day=15)
    last_day = calendar.monthrange(today.year, today.month)[1]
    return today.replace(day=16), today.replace(day=last_day)

# ─── AUTHENTICATION (New 'users' Table) ──────────────────────────────────────────
class UserOut(BaseModel):
    tid:  int
    name: str
    role: str

class RegisterBody(BaseModel):
    name:     str
    role:     str  
    pin_code: str
    tid:      Optional[int] = None

class LoginBody(BaseModel):
    tid: int
    pin_code: str

# ─── MASTER CABINET MODELS ─────────────────────────────────────────────────────
class MasterTaskCreate(BaseModel):
    master_name: str
    case_sku: str
    quantity: float

class MasterTaskUpdate(BaseModel):
    id: int
    quantity: float

class MasterWorkLogBody(BaseModel):
    master_name: str
    item_code: str
    quantity: float

@app.get("/api/auth/users", response_model=List[UserOut])
async def get_users():
    p = await get_pool()
    rows = await p.fetch("SELECT tid, name, role FROM public.masters ORDER BY name")
    return [dict(r) for r in rows]

import random

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
        SELECT tid, name, role 
        FROM public.masters
        WHERE tid = $1 AND pin_code = $2
    """, body.tid, body.pin_code)
    if not row:
        raise HTTPException(status_code=401, detail="Невірний пін-код")
    return dict(row)

# ─── EXISTING API ENDPOINTS ────────────────────────────────────────────────────

@app.get("/api/stock")
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

# ─── MASTER CABINET ENDPOINTS ──────────────────────────────────────────────────

@app.get("/api/master/dashboard")
async def get_master_dashboard(master_name: str):
    p = await get_pool()
    try:
        # Potential earnings (total plan * price)
        potential = await p.fetchval("""
            SELECT COALESCE(SUM(t.quantity * p.work_price), 0)
            FROM bot_workshop.master_tasks t
            JOIN public.master_prices p ON t.case_sku = p.item_id
            WHERE t.master_name = $1 AND t.status != 'виконано'
        """, master_name) or 0

        # Current earnings (completed qty in current cycle * price)
        cycle_start, cycle_end = cycle_date_range()
        current_earn = await p.fetchval("""
            SELECT COALESCE(SUM(l.quantity * p.work_price), 0)
            FROM bot_workshop.master_logs l
            JOIN public.master_prices p ON l.item_code = p.item_id
            WHERE l.master_name = $1 AND l.work_date BETWEEN $2 AND $3
        """, master_name, cycle_start, cycle_end) or 0

        # Master tasks with priority check
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
async def create_or_update_master_task(body: MasterTaskCreate):
    p = await get_pool()
    try:
        # Check if task already exists for this master and article
        existing = await p.fetchrow("""
            SELECT id FROM bot_workshop.master_tasks 
            WHERE master_name = $1 AND case_sku = $2 AND status != 'виконано'
        """, body.master_name, body.case_sku)
        
        if existing:
            await p.execute("""
                UPDATE bot_workshop.master_tasks SET quantity = quantity + $1 
                WHERE id = $2
            """, body.quantity, existing['id'])
            return {"status": "updated", "id": existing['id']}
        else:
            new_id = await p.fetchval("""
                INSERT INTO bot_workshop.master_tasks (master_name, case_sku, quantity, status)
                VALUES ($1, $2, $3, 'in_progress')
                RETURNING id
            """, body.master_name, body.case_sku, body.quantity)
            return {"status": "created", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/master/tasks/{task_id}")
async def delete_master_task(task_id: int):
    """Видалення завдання з повним поверненням сировини за рецептом."""
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                # Отримуємо дані завдання перед видаленням
                task = await conn.fetchrow("""
                    SELECT case_sku, completed_quantity 
                    FROM bot_workshop.master_tasks WHERE id = $1
                """, task_id)

                if not task:
                    raise HTTPException(status_code=404, detail="Task not found")

                # Якщо є виконаний факт — повертаємо сировину за рецептом
                completed = float(task['completed_quantity'] or 0)
                if completed > 0:
                    recipe = await conn.fetch("""
                        SELECT component_id, items_per_case 
                        FROM bot_workshop.recipes_cases 
                        WHERE TRIM(case_sku) ILIKE TRIM($1)
                    """, task['case_sku'])

                    for row in recipe:
                        # Повертаємо: кількість * виконано (від'ємна дельта застосована назад)
                        return_qty = float(row['items_per_case']) * completed
                        await conn.execute("""
                            UPDATE bot_workshop.cases_components 
                            SET quantity = quantity + $1,
                                last_updated = CURRENT_TIMESTAMP
                            WHERE id = $2
                        """, return_qty, row['component_id'])

                    # Також повертаємо залишок готових кейсів
                    await conn.execute("""
                        UPDATE bot_workshop.inventory_cases 
                        SET quantity = GREATEST(0, quantity - $1),
                            last_update = CURRENT_TIMESTAMP
                        WHERE item_id = $2
                    """, completed, task['case_sku'])

                # Тепер видаляємо саме завдання
                await conn.execute("DELETE FROM bot_workshop.master_tasks WHERE id = $1", task_id)

        return {"status": "deleted", "returned_components": completed > 0}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/master/logs")
async def log_master_work(body: MasterWorkLogBody, background_tasks: BackgroundTasks):
    """Внесення факту роботи з автоматичним списанням та сповіщеннями n8n."""
    p = await get_pool()
    low_stock_alerts = []  # Компоненти, що пройшли нижче ліміту після списання
    recipe = []
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                # 1. Запис у логи (bot_workshop.master_logs)
                await conn.execute("""
                    INSERT INTO bot_workshop.master_logs (master_name, work_date, item_code, quantity)
                    VALUES ($1, CURRENT_DATE, $2, $3)
                """, body.master_name, body.item_code, body.quantity)

                # 2. Оновлення плану (bot_workshop.master_tasks)
                if body.quantity > 0:
                    tasks = await conn.fetch("""
                        SELECT id, quantity, completed_quantity FROM bot_workshop.master_tasks 
                        WHERE master_name = $1 AND case_sku = $2 AND status != 'виконано'
                        ORDER BY created_at ASC
                    """, body.master_name, body.item_code)

                    remaining = body.quantity
                    for t in tasks:
                        if remaining <= 0: break
                        needed = t['quantity'] - t['completed_quantity']
                        if needed > 0:
                            take = min(remaining, needed)
                            new_completed = t['completed_quantity'] + take
                            new_status = 'виконано' if new_completed >= t['quantity'] else 'in_progress'
                            await conn.execute("""
                                UPDATE bot_workshop.master_tasks 
                                SET completed_quantity = $1, status = $2 WHERE id = $3
                            """, new_completed, new_status, t['id'])
                            remaining -= take
                else:
                    tasks = await conn.fetch("""
                        SELECT id, completed_quantity FROM bot_workshop.master_tasks 
                        WHERE master_name = $1 AND case_sku = $2 AND completed_quantity > 0 
                        ORDER BY created_at DESC
                    """, body.master_name, body.item_code)

                    to_remove = abs(body.quantity)
                    for t in tasks:
                        if to_remove <= 0: break
                        can_remove = min(to_remove, t['completed_quantity'])
                        await conn.execute("""
                            UPDATE bot_workshop.master_tasks 
                            SET completed_quantity = completed_quantity - $1, status = 'in_progress' WHERE id = $2
                        """, can_remove, t['id'])
                        to_remove -= can_remove

                # 3. Автоматика складу готових кейсів (bot_workshop.inventory_cases)
                await conn.execute("""
                    INSERT INTO bot_workshop.inventory_cases (item_id, quantity, last_update)
                    VALUES ($1, $2, CURRENT_TIMESTAMP)
                    ON CONFLICT (item_id) DO UPDATE 
                    SET quantity = bot_workshop.inventory_cases.quantity + EXCLUDED.quantity,
                        last_update = CURRENT_TIMESTAMP
                """, body.item_code, body.quantity)

                # 4. Рецепт: отримуємо компоненти для цього кейсу
                recipe = await conn.fetch("""
                    SELECT component_id, items_per_case 
                    FROM bot_workshop.recipes_cases 
                    WHERE TRIM(case_sku) ILIKE TRIM($1)
                """, body.item_code)

                for row in recipe:
                    comp_id = row['component_id']
                    items_needed = float(row['items_per_case'])
                    total_comp_diff = items_needed * body.quantity

                    # ЗАПОБІЖНИК: перевіряємо залишок ПЕРЕД списанням
                    # Якщо body.quantity > 0 (списання) і залишку не вистачить — зупиняємо транзакцію
                    if body.quantity > 0:
                        current_qty = await conn.fetchval("""
                            SELECT quantity FROM bot_workshop.cases_components WHERE id = $1
                        """, comp_id)
                        if current_qty is not None and (current_qty - total_comp_diff) < 0:
                            comp_name = await conn.fetchval("""
                                SELECT component_name FROM bot_workshop.cases_components WHERE id = $1
                            """, comp_id)
                            raise HTTPException(
                                status_code=400,
                                detail=f"Недостатньо компонента '{comp_name}': є {current_qty}, потрібно {total_comp_diff:.1f}"
                            )

                    # Списуємо/повертаємо компонент
                    await conn.execute("""
                        UPDATE bot_workshop.cases_components 
                        SET quantity = quantity - $1,
                            last_updated = CURRENT_TIMESTAMP
                        WHERE id = $2
                    """, total_comp_diff, comp_id)

                    # Зчитуємо актуальний стан після оновлення для перевірки ліміту
                    comp_state = await conn.fetchrow("""
                        SELECT component_name, quantity, min_threshold, supplier 
                        FROM bot_workshop.cases_components WHERE id = $1
                    """, comp_id)

                    # Якщо залишок нижче ліміту — додаємо у список для сповіщення n8n
                    if comp_state and comp_state['quantity'] < (comp_state['min_threshold'] or 0):
                        low_stock_alerts.append({
                            "component_name": comp_state['component_name'],
                            "supplier": comp_state['supplier'] or "",
                            "quantity": float(comp_state['quantity']),
                        })

        # 5. Після успішної транзакції — відправляємо сповіщення в n8n у фоні
        for alert in low_stock_alerts:
            background_tasks.add_task(
                notify_n8n_low_stock,
                alert['component_name'],
                alert['supplier'],
                alert['quantity'],
            )
            print(f"[Alert] Scheduled n8n notify: {alert['component_name']} = {alert['quantity']}")

        return {
            "status": "logged",
            "item": body.item_code,
            "diff": body.quantity,
            "recipe_updated": len(recipe) > 0,
            "alerts_sent": len(low_stock_alerts),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in log_master_work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/master/stats")
async def get_master_stats(master_name: str):
    p = await get_pool()
    try:
        # Aggregated stats by month cycle for the current year
        current_year = date.today().year
        rows = await p.fetch("""
            SELECT 
                CASE 
                    WHEN EXTRACT(DAY FROM ml.work_date) <= 15 THEN '01-15'
                    ELSE '16-кін'
                END as cycle,
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

        # Structure as list of periods
        ua_months = ["", "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"]
        
        periods = {}
        for r in rows:
            period_key = f"{ua_months[int(r['month'])]} ({r['cycle']})"
            if period_key not in periods:
                periods[period_key] = {"earnings": 0, "models": []}
            
            periods[period_key]["earnings"] += r['total_earn']
            periods[period_key]["models"].append({
                "name": r['item_code'],
                "qty": r['total_qty']
            })
        
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
