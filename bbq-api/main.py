from fastapi import FastAPI, HTTPException, Request, status, BackgroundTasks, Body
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any, Literal
import asyncpg
import os
import httpx
import json
from datetime import date
from dotenv import load_dotenv
import random
import calendar
import uuid

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

class FinishedMainReplenishBody(BaseModel):
    article: str
    quantity: int
    is_engraved: bool

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

class InventoryCheckBody(BaseModel):
    item_id: str
    table_key: str
    actual_qty: float
    note: Optional[str] = None

class WholesaleItem(BaseModel):
    article: str
    quantity: float

class WholesaleReserveBody(BaseModel):
    source: Literal['sd', 'mydrop']
    source_order_id: str
    client_name: Optional[str] = None
    phone: Optional[str] = None
    items: List[WholesaleItem]

class WholesaleSourceBody(BaseModel):
    article: str
    from_master: float
    from_warehouse: float
    from_scratch: float

class ShipmentSourceBody(BaseModel):
    report_date: date
    article: str
    category: str
    finished_main_qty: int
    tid: int

class RetroactiveSourceBody(BaseModel):
    report_date: date
    article: str
    category: str
    finished_main_qty: int
    tid: int

class PickupItem(BaseModel):
    article: str
    quantity: float

class PickupReserveBody(BaseModel):
    source: str
    source_order_id: str
    client_name: Optional[str] = None
    phone: Optional[str] = None
    items: List[PickupItem]

class OfficeTaskCreate(BaseModel):
    admin_comment: str
    created_by: Optional[str] = None
    assignee_role: Literal['driver', 'master'] = 'driver'
    priority: Literal['none', 'low', 'medium', 'high'] = 'none'

class OfficeStockUpdate(BaseModel):
    item_id: str
    new_quantity: int

class OfficeStockReceiveItem(BaseModel):
    item_id: str
    qty: int

class OfficeStockReceiveBody(BaseModel):
    task_id: int
    items: List[OfficeStockReceiveItem]

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
            SELECT item_id::text, item_id::text AS name, quantity::float, NULL::float, NULL::text, NULL::float, 'ok' AS status,
                CASE WHEN is_engraved THEN 'finished_main' ELSE 'finished_main_engraved' END AS category
            FROM bot_workshop.inventory_finished_main

            UNION ALL
            SELECT item_id::text, item_name AS name, quantity::float,
                min_limit::float, NULL::text AS unit_type, NULL::float AS conversion_factor,
                CASE
                    WHEN min_limit IS NULL         THEN 'ok'
                    WHEN quantity <= 0             THEN 'critical'
                    WHEN quantity <= min_limit     THEN 'critical'
                    WHEN quantity <= min_limit*1.5 THEN 'low'
                    ELSE 'ok'
                END AS status, 'loot_box_main' AS category
            FROM bot_workshop.loot_box_main

            UNION ALL
            SELECT item_id::text, item_name, quantity::float, min_limit::float,
                NULL::text, NULL::float,
                CASE
                    WHEN min_limit IS NULL         THEN 'ok'
                    WHEN quantity <= 0             THEN 'critical'
                    WHEN quantity <= min_limit     THEN 'critical'
                    WHEN quantity <= min_limit*1.5 THEN 'low'
                    ELSE 'ok'
                END AS status, 'loot_box_operative' AS category
            FROM bot_workshop.loot_box_operative

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

@app.get("/api/cycle")
async def get_cycle():
    return {"cycle": current_cycle()}

async def _fetch_shipments(conn) -> list:
    rows = await conn.fetch("""
        SELECT report_date, category, article, quantity,
               extras, pickup_time, is_wholesale
        FROM bot_workshop.shipment_lists
        ORDER BY report_date DESC, id ASC
    """)

    # finished_main override — daily_shipments і shipment_lists різні таблиці
    # без FK (shipment_lists будується зовнішнім процесом з агрегацією/extras-
    # згортанням), тож зіставляємо по (report_date, нормалізований article,
    # category), тією ж _normalize_article, що й run_write_off. category на
    # daily_shipments — NULL для рядків, записаних до впровадження цієї
    # колонки зовнішнім процесом (n8n) — такі рядки свідомо виключені з усіх
    # override-мап нижче (WHERE category IS NOT NULL): без category
    # неможливо надійно визначити, якій з двох ліній (Звичайні/Гравіювання)
    # на ту саму (дата, артикул) вони належать, і вгадувати не можна.
    pending = await conn.fetch("""
        SELECT report_date, article, category, COALESCE(finished_main_qty, 0) AS finished_main_qty
        FROM bot_workshop.daily_shipments
        WHERE is_written_off = false AND COALESCE(finished_main_qty, 0) > 0
          AND category IS NOT NULL
    """)
    override_map = {}
    for r in pending:
        _, base_article = _normalize_article(r['article'])
        key = (r['report_date'], base_article, r['category'])
        override_map[key] = override_map.get(key, 0) + r['finished_main_qty']

    fm_stock_rows = await conn.fetch("SELECT item_id, quantity, is_engraved FROM bot_workshop.inventory_finished_main")
    fm_stock = {(r['item_id'].strip().upper(), r['is_engraved']): r['quantity'] for r in fm_stock_rows}

    # is_written_off — за (report_date, base_article, category): True лише
    # якщо існує хоч один daily_shipments рядок для цього ключа І всі такі
    # рядки вже списані. Потрібно фронтенду, щоб показувати ретроактивний
    # контроль тільки для вже списаних позицій (а не для ще pending).
    # total_qty_map — сума quantity по всіх рядках ключа, той самий
    # total_qty, що й у /retroactive-source, потрібен фронтенду для
    # відображення "X / Y".
    ds_rows = await conn.fetch("""
        SELECT report_date, article, category, quantity, is_written_off
        FROM bot_workshop.daily_shipments
        WHERE category IS NOT NULL
    """)
    written_off_map = {}
    total_qty_map = {}
    for r in ds_rows:
        _, base = _normalize_article(r['article'])
        key = (r['report_date'], base, r['category'])
        written_off_map[key] = written_off_map.get(key, True) and r['is_written_off']
        total_qty_map[key] = total_qty_map.get(key, 0) + r['quantity']

    # Скільки вже було ретроактивно скориговано раніше — те саме, що рахує
    # /retroactive-source перед кожним викликом (див. already_corrected там),
    # тут потрібно фронтенду для відображення "Скориговано: X / Y".
    retro_rows = await conn.fetch("""
        SELECT report_date, article, category, COALESCE(SUM(-qty), 0) AS corrected
        FROM bot_workshop.history_logs
        WHERE operation = 'write_off_finished_main_retroactive' AND category IS NOT NULL
        GROUP BY report_date, article, category
    """)
    retro_map = {}
    for r in retro_rows:
        _, base = _normalize_article(r['article'])
        key = (r['report_date'], base, r['category'])
        retro_map[key] = retro_map.get(key, 0) + r['corrected']

    result = []
    for r in rows:
        d = dict(r)
        _, base_article = _normalize_article(d['article'])
        key = (d['report_date'], base_article, d['category'])
        is_engraved = _resolve_is_engraved(d['category'])
        d['finished_main_qty'] = override_map.get(key, 0)
        d['finished_main_available'] = fm_stock.get((base_article, is_engraved), 0)
        d['is_written_off'] = written_off_map.get(key, False)
        d['retroactive_total_qty'] = total_qty_map.get(key, 0)
        d['retroactive_corrected_qty'] = retro_map.get(key, 0)
        result.append(d)
    return result

@app.get("/api/master/shipments")
async def get_shipments():
    p = await get_pool()
    try:
        return await _fetch_shipments(p)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/shipments")
async def get_shipments_admin():
    p = await get_pool()
    try:
        return await _fetch_shipments(p)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Вова, Матей — тільки ці двоє бачать/використовують інлайн-контроль джерела
# для звичайних відправок (не роль, конкретні tid). Фронтенд ховає контрол,
# бекенд тут — друга лінія захисту (див. відоме обмеження нижче).
SHIPMENT_SOURCE_OVERRIDE_WHITELIST = {417930, 397956}

@app.patch("/api/master/shipments/source")
async def set_shipment_source(body: ShipmentSourceBody):
    # НЕ справжня авторизація — tid надсилається клієнтом, не звіряється з
    # жодною сесією/токеном (їх в апці взагалі немає). Зупиняє випадкове
    # використання через звичайний UI, не навмисний спуфінг.
    if body.tid not in SHIPMENT_SOURCE_OVERRIDE_WHITELIST:
        raise HTTPException(status_code=403, detail="Немає доступу до цієї функції")

    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                _, base_article = _normalize_article(body.article)

                NOT_OVERRIDABLE = {'ГРАВІЮВАННЯ ШАМПУРІВ', 'ЧОХОЛ', 'ЧОХОЛ М', 'ЧОХОЛ В', 'ПИЛЬНИК', 'ДОЩЕЧКА'}
                if base_article in NOT_OVERRIDABLE:
                    raise HTTPException(status_code=400, detail="Ця позиція не підтримує розподіл джерела")

                if body.finished_main_qty < 0:
                    raise HTTPException(status_code=400, detail="Кількість не може бути від'ємною")

                is_engraved = _resolve_is_engraved(body.category)
                fm_row = await conn.fetchrow(
                    "SELECT quantity FROM bot_workshop.inventory_finished_main WHERE item_id = $1 AND is_engraved = $2",
                    base_article, is_engraved
                )
                fm_available = fm_row['quantity'] if fm_row else 0
                if body.finished_main_qty > fm_available:
                    raise HTTPException(status_code=400, detail=f"Перевищує наявність на складі ({fm_available})")

                # category = $2 (точний збіг, не is_engraved-пул) — щоб дві
                # лінії shipment_lists на той самий (дата, артикул) з різними
                # category (Звичайні/Гравіювання) не ділили один і той самий
                # набір daily_shipments рядків. Рядки з category IS NULL
                # (легасі, до впровадження колонки зовнішнім процесом)
                # природньо виключені — NULL ніколи не дорівнює body.category.
                rows = await conn.fetch("""
                    SELECT id, article, quantity FROM bot_workshop.daily_shipments
                    WHERE report_date = $1 AND is_written_off = false AND category = $2
                """, body.report_date, body.category)

                matching = []
                for r in rows:
                    _, r_base = _normalize_article(r['article'])
                    if r_base == base_article:
                        matching.append(r)

                if not matching:
                    raise HTTPException(status_code=404, detail="Відправку не знайдено на цю дату")

                total_qty = sum(r['quantity'] for r in matching)
                if body.finished_main_qty > total_qty:
                    raise HTTPException(status_code=400, detail=f"Перевищує кількість позиції ({total_qty})")

                # Скидаємо і перерозподіляємо детерміновано по id — кожен рядок
                # отримує не більше за власний quantity.
                matching.sort(key=lambda r: r['id'])
                remaining = body.finished_main_qty
                for r in matching:
                    take = min(remaining, r['quantity'])
                    await conn.execute(
                        "UPDATE bot_workshop.daily_shipments SET finished_main_qty = $1 WHERE id = $2",
                        take, r['id']
                    )
                    remaining -= take

        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Операції, що представляють фактичне списання каскаду (те, що ретроактивна
# корекція має право відкотити). write_off_finished_main/-retroactive НЕ
# входять — ці рядки вже й так відображають списання зі складу, а не каскаду,
# їх відкочувати не потрібно (і не можна, інакше склад отримає подвійний
# приход).
CASCADE_WRITE_OFF_OPERATIONS = (
    'write_off_direct', 'write_off_finished', 'write_off_component',
    'write_off_case', 'write_off_box',
)

# Мапа джерела (history_logs.source) → таблиця інвентарю, куди повертаємо
# кількість при відкоті. Дзеркало таблиць, які саме run_write_off списує.
REVERSAL_TARGET_TABLE = {
    'inventory_operative': 'bot_workshop.inventory_operative',
    'loot_box_operative': 'bot_workshop.loot_box_operative',
    'inventory_finished': 'bot_workshop.inventory_finished',
    'inventory_cases': 'bot_workshop.inventory_cases',
}

@app.post("/api/master/shipments/retroactive-source")
async def set_shipment_retroactive_source(body: RetroactiveSourceBody):
    # Той самий whitelist, що й у pre-writeoff контролі — див. коментар там.
    if body.tid not in SHIPMENT_SOURCE_OVERRIDE_WHITELIST:
        raise HTTPException(status_code=403, detail="Немає доступу до цієї функції")

    if body.finished_main_qty <= 0:
        raise HTTPException(status_code=400, detail="Кількість має бути більшою за нуль")

    if body.report_date > date.today():
        raise HTTPException(status_code=400, detail="report_date не може бути в майбутньому")
    if (date.today() - body.report_date).days > 7:
        raise HTTPException(status_code=400, detail="Ретроактивна корекція доступна лише для відправок за останні 7 днів")

    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                _, base_article = _normalize_article(body.article)

                # category = body.category (точний збіг) — той самий принцип,
                # що й у живому PATCH-контролі: не дозволяємо двом лініям
                # shipment_lists (Звичайні/Гравіювання) на той самий (дата,
                # артикул) ділити один набір daily_shipments рядків. Рядки з
                # category IS NULL (легасі) природньо виключені.
                rows = await conn.fetch("""
                    SELECT id, article, quantity, is_written_off FROM bot_workshop.daily_shipments
                    WHERE report_date = $1 AND category = $2
                """, body.report_date, body.category)
                matching = [r for r in rows if _normalize_article(r['article'])[1] == base_article]

                if not matching:
                    raise HTTPException(status_code=404, detail="Відправку не знайдено на цю дату")

                if not all(r['is_written_off'] for r in matching):
                    raise HTTPException(
                        status_code=400,
                        detail="Ця позиція ще не повністю списана — використайте звичайний контроль джерела (до списання)"
                    )

                total_qty = sum(r['quantity'] for r in matching)

                # Знаходимо каскадні рядки history_logs, які реально відповідають
                # цьому (report_date, article) — ТІЛЬКИ якщо вони позначені
                # write_off_session_id/report_date (тобто оброблені ПІСЛЯ
                # структурного фіксу). SQL `report_date = $2` сам по собі вже
                # відсікає старі рядки з report_date IS NULL (NULL = X ніколи
                # не TRUE) — write_off_session_id IS NOT NULL додано як
                # явна другорядна перевірка (в поточному коді вони завжди
                # ставляться разом, в одному INSERT).
                # category = $3 — той самий принцип: history_logs, записані
                # run_write_off ДО впровадження category (NULL), або для
                # іншої category-лінії на той самий (дата, артикул), сюди не
                # потраплять.
                hist_rows = await conn.fetch(f"""
                    SELECT id, component, qty, source, operation, write_off_session_id
                    FROM bot_workshop.history_logs
                    WHERE article = $1 AND report_date = $2 AND category = $3
                      AND write_off_session_id IS NOT NULL
                      AND operation = ANY($4::text[])
                """, base_article, body.report_date, body.category, list(CASCADE_WRITE_OFF_OPERATIONS))

                if not hist_rows:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Це списання відбулось до впровадження відстеження по датах "
                            "або по категорії (write_off_session_id/report_date/category "
                            "відсутні в history_logs) — неможливо безпечно визначити, що "
                            "саме було списано. Ретроактивна корекція для цього запису "
                            "недоступна."
                        )
                    )

                # Скільки вже було ретроактивно скориговано раніше для цього
                # (report_date, article, category) — щоб повторні виклики не
                # відкочували більше, ніж було фактично списано.
                already_corrected = await conn.fetchval("""
                    SELECT COALESCE(SUM(-qty), 0) FROM bot_workshop.history_logs
                    WHERE article = $1 AND report_date = $2 AND category = $3
                      AND operation = 'write_off_finished_main_retroactive'
                """, base_article, body.report_date, body.category)

                if already_corrected + body.finished_main_qty > total_qty:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Перевищує кількість позиції ({total_qty}), з них вже "
                            f"скориговано раніше: {already_corrected}"
                        )
                    )

                is_engraved = _resolve_is_engraved(body.category)
                fm_row = await conn.fetchrow(
                    "SELECT quantity FROM bot_workshop.inventory_finished_main WHERE item_id = $1 AND is_engraved = $2",
                    base_article, is_engraved
                )
                fm_available = fm_row['quantity'] if fm_row else 0
                if body.finished_main_qty > fm_available:
                    raise HTTPException(status_code=400, detail=f"Перевищує наявність на складі ({fm_available})")

                fraction = body.finished_main_qty / total_qty
                correction_session_id = str(uuid.uuid4())
                reversed_components = []
                remainder_notes = []

                for hr in hist_rows:
                    target_table = REVERSAL_TARGET_TABLE.get(hr['source'])
                    if not target_table:
                        # Не повинно траплятись за нормальної роботи каскаду —
                        # краще зупинити корекцію, ніж мовчки пропустити рядок.
                        raise HTTPException(
                            status_code=500,
                            detail=f"Невідоме джерело в history_logs: {hr['source']} (id={hr['id']})"
                        )

                    original_deducted = -hr['qty']  # qty в history_logs завжди від'ємний для списання
                    exact_reversal = original_deducted * fraction
                    reversal_amount = int(exact_reversal)  # округлення ВНИЗ, залишок — нижче
                    remainder = exact_reversal - reversal_amount

                    if remainder > 0:
                        remainder_notes.append({
                            "component": hr['component'],
                            "source": hr['source'],
                            "remainder": round(remainder, 4),
                        })

                    if reversal_amount > 0:
                        await conn.execute(f"""
                            UPDATE {target_table}
                            SET quantity = quantity + $1
                            WHERE item_id = $2
                        """, reversal_amount, hr['component'])
                        await conn.execute("""
                            INSERT INTO bot_workshop.history_logs
                                (session_id, article, component, qty, source, operation, write_off_session_id, report_date, category)
                            VALUES ($1, $2, $3, $4, $5, 'write_off_reversal', $1, $6, $7)
                        """, correction_session_id, base_article, hr['component'], reversal_amount, hr['source'], body.report_date, body.category)
                        reversed_components.append({"component": hr['component'], "source": hr['source'], "qty": reversal_amount})

                await conn.execute("""
                    UPDATE bot_workshop.inventory_finished_main
                    SET quantity = quantity - $1
                    WHERE item_id = $2 AND is_engraved = $3
                """, body.finished_main_qty, base_article, is_engraved)
                await conn.execute("""
                    INSERT INTO bot_workshop.history_logs
                        (session_id, article, component, qty, source, operation, write_off_session_id, report_date, category)
                    VALUES ($1, $2, $2, $3, 'inventory_finished_main', 'write_off_finished_main_retroactive', $1, $4, $5)
                """, correction_session_id, base_article, -body.finished_main_qty, body.report_date, body.category)

        return {
            "status": "ok",
            "reversed": reversed_components,
            "finished_main_deducted": body.finished_main_qty,
            "remainder_notes": remainder_notes,
        }
    except HTTPException:
        raise
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

            SELECT 'cases_components' AS source, component_name AS item_id, quantity::float, min_threshold::float AS limit_val, is_internal, id::text, unit_type, conversion_factor
            FROM bot_workshop.cases_components
            WHERE min_threshold IS NOT NULL AND quantity <= min_threshold

            UNION ALL

            SELECT 'defects' AS source, sku AS item_id, 0 AS quantity, 0 AS limit_val, NULL::boolean AS is_internal, NULL::text AS id, NULL::text AS unit_type, NULL::float AS conversion_factor
            FROM bot_workshop.defects
            WHERE status != 'fixed'

            UNION ALL

            SELECT 'loot_box_operative' AS source, item_id, quantity::float, min_limit::float AS limit_val, NULL::boolean AS is_internal, NULL::text AS id, NULL::text AS unit_type, NULL::float AS conversion_factor
            FROM bot_workshop.loot_box_operative
            WHERE min_limit IS NOT NULL AND quantity <= min_limit

            UNION ALL

            SELECT 'loot_box_main' AS source, item_id, quantity::float, min_limit::float AS limit_val, NULL::boolean AS is_internal, NULL::text AS id, NULL::text AS unit_type, NULL::float AS conversion_factor
            FROM bot_workshop.loot_box_main
            WHERE min_limit IS NOT NULL AND quantity <= min_limit
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
                       driver_comment, admin_comment, is_simple, priority, assignee_role
                FROM bot_workshop.incoming_tasks
                WHERE status = $1
                ORDER BY created_at DESC
            """, status_filter)
        else:
            rows = await p.fetch("""
                SELECT id, item_id, target_qty, actual_qty, status,
                       to_char(created_at, 'DD.MM.YY HH24:MI') AS created_at,
                       to_char(completed_at, 'DD.MM.YY HH24:MI') AS completed_at,
                       driver_comment, admin_comment, is_simple, priority, assignee_role
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

@app.post("/api/office/tasks")
async def create_office_task(body: OfficeTaskCreate):
    p = await get_pool()
    try:
        new_id = await p.fetchval("""
            INSERT INTO bot_workshop.incoming_tasks
                (item_id, target_qty, status, admin_comment, is_simple, task_type, source_role, created_by, assignee_role, priority)
            VALUES ('', 0, 'очікується', $1, true, 'simple', 'office', $2, $3, $4)
            RETURNING id
        """, body.admin_comment, body.created_by, body.assignee_role, body.priority)
        return {"status": "created", "id": new_id}
    except Exception as e:
        print(f"Error in POST /api/office/tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/office/tasks")
async def get_office_tasks():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT id, admin_comment, status, created_by, priority, assignee_role,
                   to_char(created_at, 'DD.MM.YY HH24:MI') AS created_at,
                   to_char(completed_at, 'DD.MM.YY HH24:MI') AS completed_at
            FROM bot_workshop.incoming_tasks
            WHERE source_role = 'office'
            ORDER BY CASE status
                WHEN 'очікується' THEN 1
                WHEN 'в роботі' THEN 2
                WHEN 'прийнято' THEN 3
                ELSE 4
            END, created_at DESC
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error in GET /api/office/tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/office/pending-orders")
async def get_office_pending_orders():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT id, admin_comment, created_by, priority, assignee_role,
                   to_char(created_at, 'DD.MM.YY HH24:MI') AS created_at, status
            FROM bot_workshop.incoming_tasks
            WHERE source_role = 'office' AND status IN ('очікується', 'в роботі')
            ORDER BY created_at ASC
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error in GET /api/office/pending-orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/master/office-orders")
async def get_master_office_orders():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT id, admin_comment, created_by, priority,
                   to_char(created_at, 'DD.MM.YY HH24:MI') AS created_at, status
            FROM bot_workshop.incoming_tasks
            WHERE source_role = 'office' AND assignee_role = 'master' AND status != 'архів'
            ORDER BY CASE priority
                WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4
            END, created_at ASC
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error in GET /api/master/office-orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/office/stock")
async def get_office_stock():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT item_id, quantity, min_qty,
                   to_char(last_delivery_date, 'DD.MM.YY HH24:MI') AS last_delivery_date
            FROM bot_workshop.office_stock
            ORDER BY item_id
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error in GET /api/office/stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/office/stock")
async def update_office_stock(body: OfficeStockUpdate):
    p = await get_pool()
    try:
        row = await p.fetchrow("""
            UPDATE bot_workshop.office_stock SET quantity = $1
            WHERE item_id = $2
            RETURNING item_id, quantity
        """, body.new_quantity, body.item_id)
        if not row:
            raise HTTPException(status_code=404, detail="Артикул не знайдено в office_stock")
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in PATCH /api/office/stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/office/stock/receive")
async def receive_office_stock(body: OfficeStockReceiveBody):
    p = await get_pool()
    try:
        if not body.items:
            raise HTTPException(status_code=400, detail="Додайте хоча б один артикул")
        async with p.acquire() as conn:
            async with conn.transaction():
                task = await conn.fetchrow(
                    "SELECT id, assignee_role, status FROM bot_workshop.incoming_tasks WHERE id = $1 AND source_role = 'office'",
                    body.task_id
                )
                if not task:
                    raise HTTPException(status_code=404, detail="Задача офісу не знайдена")
                if task['assignee_role'] != 'master':
                    raise HTTPException(status_code=400, detail="Ця дія доступна лише для тасок майстра")
                if task['status'] == 'архів':
                    raise HTTPException(status_code=400, detail="Задача вже підтверджена")
                for item in body.items:
                    updated = await conn.fetchval("""
                        UPDATE bot_workshop.office_stock
                        SET quantity = quantity + $1, last_delivery_date = CURRENT_TIMESTAMP
                        WHERE item_id = $2
                        RETURNING item_id
                    """, item.qty, item.item_id)
                    if not updated:
                        raise HTTPException(status_code=404, detail=f"Артикул {item.item_id} не знайдено в office_stock")
                await conn.execute("""
                    UPDATE bot_workshop.incoming_tasks
                    SET status = 'архів', completed_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                """, body.task_id)
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in POST /api/office/stock/receive: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
    valid_tables = ('finished', 'operative', 'components', 'main', 'cases_empty', 'finished_main', 'loot_box_operative', 'loot_box_main')
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
                    # Ця сторінка (AdminWarehouses) редагує лише стандартний
                    # (is_engraved=true) пул — пул заготовок під гравіювання
                    # поки що коригується напряму SQL (окрема майбутня задача
                    # для UI поповнення обох пулів).
                    row = await conn.fetchrow("SELECT quantity FROM bot_workshop.inventory_finished_main WHERE item_id = $1 AND is_engraved = true", body.item_id)
                    if row:
                        old_qty = int(row['quantity'] or 0)
                        await conn.execute("UPDATE bot_workshop.inventory_finished_main SET quantity = $1 WHERE item_id = $2 AND is_engraved = true", body.new_quantity, body.item_id)
                    else:
                        await conn.execute("INSERT INTO bot_workshop.inventory_finished_main (item_id, quantity, is_engraved) VALUES ($1, $2, true)", body.item_id, body.new_quantity)

                elif body.table_key == 'components':
                    row = await conn.fetchrow("SELECT quantity FROM bot_workshop.cases_components WHERE id = $1::int", body.item_id)
                    if row:
                        old_qty = int(row['quantity'] or 0)
                        await conn.execute("UPDATE bot_workshop.cases_components SET quantity = $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2::int", body.new_quantity, body.item_id)
                    else:
                        await conn.execute("INSERT INTO bot_workshop.cases_components (id, component_name, quantity, last_updated) VALUES ($1::int, 'Нова фурнітура', $2, CURRENT_TIMESTAMP)", body.item_id, body.new_quantity)

                elif body.table_key == 'loot_box_operative':
                    row = await conn.fetchrow("SELECT quantity FROM bot_workshop.loot_box_operative WHERE item_id = $1", body.item_id)
                    if row:
                        old_qty = int(row['quantity'] or 0)
                        await conn.execute("UPDATE bot_workshop.loot_box_operative SET quantity = $1 WHERE item_id = $2", body.new_quantity, body.item_id)
                    else:
                        await conn.execute("INSERT INTO bot_workshop.loot_box_operative (item_id, item_name, quantity) VALUES ($1, $1, $2)", body.item_id, body.new_quantity)

                elif body.table_key == 'loot_box_main':
                    row = await conn.fetchrow("SELECT quantity FROM bot_workshop.loot_box_main WHERE item_id = $1", body.item_id)
                    if row:
                        old_qty = int(row['quantity'] or 0)
                        await conn.execute("UPDATE bot_workshop.loot_box_main SET quantity = $1, last_update = CURRENT_TIMESTAMP WHERE item_id = $2", body.new_quantity, body.item_id)
                    else:
                        await conn.execute("INSERT INTO bot_workshop.loot_box_main (item_id, item_name, quantity) VALUES ($1, $1, $2)", body.item_id, body.new_quantity)

                delta = body.new_quantity - old_qty
                if delta != 0:
                    await conn.execute("""
                        INSERT INTO bot_workshop.system_logs
                            (actor, action, table_key, item_id, old_qty, new_qty, delta, note)
                        VALUES ('admin', 'inline_edit', $1, $2, $3, $4, $5, 'Ручне коригування адміна')
                    """, body.table_key, str(body.item_id), old_qty, body.new_quantity, delta)
                    
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
                        INSERT INTO bot_workshop.system_logs
                            (actor, action, table_key, item_id, old_qty, new_qty, delta, note)
                        VALUES ('admin', 'replenish_component', 'components', $1, NULL, NULL, $2, 'Поповнення внутрішньої фурнітури')
                    """, comp["component_name"], qty_to_add)
                    return {"success": True, "mode": "direct", "added_qty": qty_to_add}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in POST /api/admin/components/{component_id}/replenish: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/inventory/finished-main/replenish")
async def replenish_finished_main(body: FinishedMainReplenishBody):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="Кількість має бути більшою за нуль")
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow("""
                    INSERT INTO bot_workshop.inventory_finished_main (item_id, quantity, is_engraved)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (item_id, is_engraved)
                    DO UPDATE SET quantity = inventory_finished_main.quantity + EXCLUDED.quantity
                    RETURNING quantity
                """, body.article, body.quantity, body.is_engraved)
                # Той самий напрямок, що й _resolve_is_engraved: is_engraved=false —
                # пул під гравіювання, is_engraved=true — стандартний пул.
                category = 'Звичайні' if body.is_engraved else 'Гравіювання'
                await conn.execute("""
                    INSERT INTO bot_workshop.history_logs
                        (article, component, qty, source, operation, category)
                    VALUES ($1, $1, $2, 'inventory_finished_main', 'replenish_finished_main', $3)
                """, body.article, body.quantity, category)
                return {"status": "ok", "new_quantity": row["quantity"]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in POST /api/admin/inventory/finished-main/replenish: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/driver/tasks")
async def get_driver_tasks():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT it.id, it.item_id, it.target_qty, it.actual_qty, it.status,
                   it.admin_comment, it.driver_comment, it.is_simple, it.created_at,
                   it.task_type, it.priority,
                   it.component_id, it.input_qty, it.unit_type, it.conversion_factor,
                   pr.pcs_per_pack, pr.packs_per_box, pr.pcs_per_box
            FROM bot_workshop.incoming_tasks it
            LEFT JOIN bot_workshop.packaging_rules pr ON pr.item_id = it.item_id
            WHERE it.status IN ('очікується', 'в роботі') AND COALESCE(it.assignee_role, 'driver') != 'master'
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
                        INSERT INTO bot_workshop.system_logs
                            (actor, action, table_key, item_id, old_qty, new_qty, delta, note)
                        VALUES ('driver', 'replenish_component', 'components', $1, NULL, NULL, $2, 'Доставка водієм')
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
        task = await p.fetchrow("SELECT is_simple, assignee_role FROM bot_workshop.incoming_tasks WHERE id = $1", task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Задачу не знайдено")
        if not task['is_simple']:
            raise HTTPException(status_code=400, detail="Одноклікове завершення доступне лише для простих завдань")
        if task['assignee_role'] != 'driver':
            raise HTTPException(status_code=400, detail="Це завдання призначене не водію")

        row = await p.fetchrow("""
            UPDATE bot_workshop.incoming_tasks
            SET status = 'архів', completed_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        """, task_id)
        return dict(row)
    except HTTPException:
        raise
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
                   driver_comment, is_simple, created_at, completed_at, priority
            FROM bot_workshop.incoming_tasks
            WHERE status = 'прийнято' AND COALESCE(assignee_role, 'driver') != 'master'
            ORDER BY completed_at DESC
            LIMIT 50
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/inventory/check")
async def inventory_check(body: InventoryCheckBody):
    valid_tables = ('finished', 'operative', 'main', 'cases_empty', 'finished_main', 'components', 'loot_box_operative', 'loot_box_main')
    if body.table_key not in valid_tables:
        raise HTTPException(status_code=400, detail="Invalid table_key")
    p = await get_pool()
    try:
        if body.table_key == 'finished':
            row = await p.fetchrow("SELECT quantity FROM bot_workshop.inventory_finished WHERE item_id = $1", body.item_id)
        elif body.table_key == 'operative':
            row = await p.fetchrow("SELECT quantity FROM bot_workshop.inventory_operative WHERE item_id = $1", body.item_id)
        elif body.table_key == 'main':
            row = await p.fetchrow("SELECT quantity FROM bot_workshop.inventory_main WHERE item_id = $1", body.item_id)
        elif body.table_key == 'cases_empty':
            row = await p.fetchrow("SELECT quantity FROM bot_workshop.inventory_cases WHERE item_id = $1", body.item_id)
        elif body.table_key == 'finished_main':
            # Ця перевірка (AdminWarehouses) стосується лише стандартного
            # (is_engraved=true) пулу — див. коментар в /api/admin/inventory.
            row = await p.fetchrow("SELECT quantity FROM bot_workshop.inventory_finished_main WHERE item_id = $1 AND is_engraved = true", body.item_id)
        elif body.table_key == 'components':
            row = await p.fetchrow("SELECT quantity FROM bot_workshop.cases_components WHERE id = $1", int(body.item_id))
        elif body.table_key == 'loot_box_operative':
            row = await p.fetchrow("SELECT quantity FROM bot_workshop.loot_box_operative WHERE item_id = $1", body.item_id)
        elif body.table_key == 'loot_box_main':
            row = await p.fetchrow("SELECT quantity FROM bot_workshop.loot_box_main WHERE item_id = $1", body.item_id)

        system_qty = float(row['quantity']) if row else 0.0
        raw_diff = body.actual_qty - system_qty

        prev_check = await p.fetchrow("""
            SELECT delta FROM bot_workshop.inventory_checks
            WHERE item_id = $1 AND table_key = $2
            ORDER BY checked_at DESC, id DESC
            LIMIT 1
        """, body.item_id, body.table_key)
        prev_cumulative = float(prev_check['delta']) if prev_check else 0.0
        delta = prev_cumulative + raw_diff

        new_row = await p.fetchrow("""
            INSERT INTO bot_workshop.inventory_checks
                (item_id, table_key, system_qty, actual_qty, delta, raw_diff, note, checked_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            RETURNING id, item_id, table_key, system_qty, actual_qty, delta, raw_diff,
                      to_char(checked_at, 'DD.MM.YY HH24:MI') AS checked_at
        """, body.item_id, body.table_key, system_qty, body.actual_qty, delta, raw_diff, body.note)

        # Оновлюємо системне qty до фактичного значення
        if body.table_key == 'finished':
            await p.execute("UPDATE bot_workshop.inventory_finished SET quantity = $1 WHERE item_id = $2", body.actual_qty, body.item_id)
        elif body.table_key == 'operative':
            await p.execute("UPDATE bot_workshop.inventory_operative SET quantity = $1 WHERE item_id = $2", body.actual_qty, body.item_id)
        elif body.table_key == 'main':
            await p.execute("UPDATE bot_workshop.inventory_main SET quantity = $1 WHERE item_id = $2", body.actual_qty, body.item_id)
        elif body.table_key == 'cases_empty':
            await p.execute("UPDATE bot_workshop.inventory_cases SET quantity = $1 WHERE item_id = $2", body.actual_qty, body.item_id)
        elif body.table_key == 'finished_main':
            await p.execute("UPDATE bot_workshop.inventory_finished_main SET quantity = $1 WHERE item_id = $2 AND is_engraved = true", body.actual_qty, body.item_id)
        elif body.table_key == 'components':
            await p.execute("UPDATE bot_workshop.cases_components SET quantity = $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2", body.actual_qty, int(body.item_id))
        elif body.table_key == 'loot_box_operative':
            await p.execute("UPDATE bot_workshop.loot_box_operative SET quantity = $1 WHERE item_id = $2", body.actual_qty, body.item_id)
        elif body.table_key == 'loot_box_main':
            await p.execute("UPDATE bot_workshop.loot_box_main SET quantity = $1, last_update = CURRENT_TIMESTAMP WHERE item_id = $2", body.actual_qty, body.item_id)

        return dict(new_row)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in POST /api/admin/inventory/check: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/inventory/checks/latest")
async def get_latest_checks():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT DISTINCT ON (item_id, table_key)
                item_id, table_key, delta,
                to_char(checked_at, 'DD.MM.YY HH24:MI') AS checked_at
            FROM bot_workshop.inventory_checks
            ORDER BY item_id, table_key, inventory_checks.checked_at DESC, id DESC
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error in GET /api/admin/inventory/checks/latest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/writeoff-logs")
async def get_writeoff_logs(
    date_from: str = None,
    date_to: str = None,
    operation: str = None,
    search: str = None
):
    p = await get_pool()
    date_from_parsed = date.fromisoformat(date_from) if date_from else None
    date_to_parsed = date.fromisoformat(date_to) if date_to else None
    try:
        conditions = []
        params = []
        if date_from_parsed:
            params.append(date_from_parsed)
            conditions.append(f"dt_create::date >= ${len(params)}")
        if date_to_parsed:
            params.append(date_to_parsed)
            conditions.append(f"dt_create::date <= ${len(params)}")
        if operation:
            params.append(operation)
            conditions.append(f"operation = ${len(params)}")
        if search:
            params.append(f"%{search}%")
            conditions.append(f"(article ILIKE ${len(params)} OR component ILIKE ${len(params)})")
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        rows = await p.fetch(f"""
            SELECT id,
                   to_char(dt_create AT TIME ZONE 'Europe/Kyiv', 'DD.MM.YY HH24:MI') AS dt_create,
                   session_id, article, component, qty, source, operation
            FROM bot_workshop.history_logs
            {where}
            ORDER BY dt_create DESC, session_id
        """, *params)
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error in GET /api/admin/writeoff-logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _normalize_article(raw_article: str) -> tuple:
    """
    Нормалізує сирий артикул так само, як історично робив run_write_off:
    uppercase+strip, кирилиця С→S для коротких кодів, потім base_article
    без H/T суфіксів (крім T1/T1S). Повертає (article, base_article).
    Спільна функція для run_write_off і override-логіки finished_main —
    НЕ для wholesale-каскаду (_resolve_wholesale_components має власну копію).
    """
    article = raw_article.strip().upper()
    if len(article) <= 5:
        article = article.replace('С', 'S')
    base_article = article
    if not article.startswith('T1'):
        base_article = article.replace('H', '').replace('T', '')
    return article, base_article

# shipment_lists.category → inventory_finished_main.is_engraved. Дані
# показали, що daily_shipments.is_engraved НЕ корелює з category (окрема
# ознака, ймовірно про гравіювання шампурів) — тож пул визначаємо тільки
# з category. 'Гравіювання' — заготовки під гравіювання (is_engraved=false),
# усі інші категорії (в т.ч. 'Звичайні') — стандартний пул (is_engraved=true).
ENGRAVING_CATEGORY = 'Гравіювання'

def _resolve_is_engraved(category: Optional[str]) -> bool:
    return category != ENGRAVING_CATEGORY

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
                shipments_raw = await conn.fetch("""
                    SELECT id, report_date, article, category, quantity, is_case, COALESCE(finished_main_qty, 0) AS finished_main_qty
                    FROM bot_workshop.daily_shipments
                    WHERE is_written_off = false
                    ORDER BY report_date, id
                """)

                if not shipments_raw:
                    return {"success": True, "written_off_count": 0, "errors": [], "details": ["Немає записів для списання"]}

                # Агрегуємо по (report_date, article, category) — раніше було
                # (report_date, article) без category, тож дві лінії
                # shipment_lists (Звичайні/Гравіювання) на той самий (дата,
                # артикул) змішувались в один агрегат і ділили один
                # finished_main_qty override. category=NULL (легасі рядки до
                # впровадження колонки) утворює свій окремий ключ — вони й
                # так не матимуть finished_main_qty > 0 через category-фільтр
                # у override-ендпоінтах, тож просто йдуть звичайним каскадом.
                aggregated = {}
                for r in shipments_raw:
                    key = (r['report_date'], r['article'].strip().upper(), r['category'])
                    if key not in aggregated:
                        aggregated[key] = {
                            'report_date': r['report_date'],
                            'article': r['article'].strip().upper(),
                            'category': r['category'],
                            'quantity': 0,
                            'is_case': r['is_case'],
                            'finished_main_qty': 0,
                        }
                    aggregated[key]['quantity'] += r['quantity']
                    aggregated[key]['finished_main_qty'] += r['finished_main_qty']
                shipments = list(aggregated.values())

                session_id = str(uuid.uuid4())

                for row in shipments:
                    s_id = None
                    qty = row['quantity']
                    is_case = row['is_case']

                    # Нормалізація артикулу (спільна функція, теж використовується
                    # для override-матчингу finished_main)
                    article, base_article = _normalize_article(row['article'])

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
                            INSERT INTO bot_workshop.history_logs (session_id, article, component, qty, source, operation, write_off_session_id, report_date, category)
                            VALUES ($1, $2, $2, $3, 'inventory_operative', 'write_off_direct', $1, $4, $5)
                        """, session_id, article, -qty, row['report_date'], row['category'])
                        details.append(f"Списано {qty} з operative: {item_id}")
                        continue

                    # 3. Ручний override "зі складу" (inventory_finished_main) —
                    # застосовується ПЕРШИМ, до основного каскаду. Виставляється
                    # інлайн у ShipmentsLog (тільки Вова/Матей); якщо складу не
                    # вистачає на момент запуску — залишок автоматично йде в
                    # незмінений каскад нижче. Пул (is_engraved) визначається
                    # з category цього агрегату — див. _resolve_is_engraved.
                    if row['finished_main_qty'] > 0:
                        row_is_engraved = _resolve_is_engraved(row['category'])
                        fm_row = await conn.fetchrow("""
                            SELECT quantity FROM bot_workshop.inventory_finished_main
                            WHERE item_id = $1 AND is_engraved = $2
                        """, base_article, row_is_engraved)
                        fm_available = fm_row['quantity'] if fm_row else 0
                        from_finished_main = min(row['finished_main_qty'], fm_available, qty)
                        if from_finished_main > 0:
                            await conn.execute("""
                                UPDATE bot_workshop.inventory_finished_main
                                SET quantity = quantity - $1
                                WHERE item_id = $2 AND is_engraved = $3
                            """, from_finished_main, base_article, row_is_engraved)
                            await conn.execute("""
                                INSERT INTO bot_workshop.history_logs (session_id, article, component, qty, source, operation, write_off_session_id, report_date, category)
                                VALUES ($1, $2, $2, $3, 'inventory_finished_main', 'write_off_finished_main', $1, $4, $5)
                            """, session_id, base_article, -from_finished_main, row['report_date'], row['category'])
                            details.append(f"Списано {from_finished_main} зі складу (finished_main): {base_article}")
                            qty -= from_finished_main

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
                            INSERT INTO bot_workshop.history_logs (session_id, article, component, qty, source, operation, write_off_session_id, report_date, category)
                            VALUES ($1, $2, $2, $3, 'inventory_finished', 'write_off_finished', $1, $4, $5)
                        """, session_id, base_article, -from_finished, row['report_date'], row['category'])
                        details.append(f"Списано {from_finished} з finished: {base_article}")

                    remaining = qty - from_finished

                    if remaining > 0:
                        if is_case:
                            # B. Кейс: inventory_cases списуємо по точному артикулу (article),
                            # наповнення (recipe + компоненти) — по базовому (base_article)
                            await conn.execute("""
                                UPDATE bot_workshop.inventory_cases
                                SET quantity = quantity - $1
                                WHERE item_id = $2
                            """, remaining, article)
                            recipe = await conn.fetch("""
                                SELECT item_id, quantity
                                FROM bot_workshop.recipes
                                WHERE UPPER(set_id) = $1
                            """, base_article)
                            for ing in recipe:
                                component = ing['item_id']
                                loot_row = await conn.fetchrow(
                                    "SELECT item_id FROM bot_workshop.loot_box_operative WHERE item_id = $1",
                                    component
                                )
                                if loot_row:
                                    target_table = 'bot_workshop.loot_box_operative'
                                    source_log = 'loot_box_operative'
                                else:
                                    target_table = 'bot_workshop.inventory_operative'
                                    source_log = 'inventory_operative'
                                await conn.execute(f"""
                                    UPDATE {target_table}
                                    SET quantity = quantity - $1
                                    WHERE item_id = $2
                                """, ing['quantity'] * remaining, component)
                                await conn.execute("""
                                    INSERT INTO bot_workshop.history_logs (session_id, article, component, qty, source, operation, write_off_session_id, report_date, category)
                                    VALUES ($1, $2, $3, $4, $5, 'write_off_component', $1, $6, $7)
                                """, session_id, base_article, component, -(ing['quantity'] * remaining), source_log, row['report_date'], row['category'])
                            await conn.execute("""
                                INSERT INTO bot_workshop.history_logs (session_id, article, component, qty, source, operation, write_off_session_id, report_date, category)
                                VALUES ($1, $2, $3, $4, 'inventory_cases', 'write_off_case', $1, $5, $6)
                            """, session_id, base_article, article, -remaining, row['report_date'], row['category'])
                            details.append(f"Списано {remaining} кейсів {article} (cases+operative)")
                        else:
                            # C. Не кейс: recipes → inventory_operative
                            recipe = await conn.fetch("""
                                SELECT item_id, quantity
                                FROM bot_workshop.recipes
                                WHERE UPPER(set_id) = $1
                            """, base_article)
                            if recipe:
                                for ing in recipe:
                                    component = ing['item_id']
                                    loot_row = await conn.fetchrow(
                                        "SELECT item_id FROM bot_workshop.loot_box_operative WHERE item_id = $1",
                                        component
                                    )
                                    if loot_row:
                                        target_table = 'bot_workshop.loot_box_operative'
                                        source_log = 'loot_box_operative'
                                    else:
                                        target_table = 'bot_workshop.inventory_operative'
                                        source_log = 'inventory_operative'
                                    await conn.execute(f"""
                                        UPDATE {target_table}
                                        SET quantity = quantity - $1
                                        WHERE item_id = $2
                                    """, ing['quantity'] * remaining, component)
                                    await conn.execute("""
                                        INSERT INTO bot_workshop.history_logs (session_id, article, component, qty, source, operation, write_off_session_id, report_date, category)
                                        VALUES ($1, $2, $3, $4, $5, 'write_off_component', $1, $6, $7)
                                    """, session_id, base_article, component, -(ing['quantity'] * remaining), source_log, row['report_date'], row['category'])
                                details.append(f"Списано {remaining} x {base_article} (гриль)")
                            else:
                                # D. Ящик: recipes_lootbox → loot_box_operative або inventory_operative
                                loot_recipe = await conn.fetch("""
                                    SELECT item_id, quantity
                                    FROM bot_workshop.recipes_lootbox
                                    WHERE UPPER(box_id) = $1
                                """, base_article)
                                if loot_recipe:
                                    for ing in loot_recipe:
                                        component = ing['item_id']
                                        loot_row = await conn.fetchrow(
                                            "SELECT item_id FROM bot_workshop.loot_box_operative WHERE item_id = $1",
                                            component
                                        )
                                        if loot_row:
                                            target_table = 'bot_workshop.loot_box_operative'
                                            source_log = 'loot_box_operative'
                                        else:
                                            target_table = 'bot_workshop.inventory_operative'
                                            source_log = 'inventory_operative'
                                        await conn.execute(f"""
                                            UPDATE {target_table}
                                            SET quantity = quantity - $1
                                            WHERE item_id = $2
                                        """, ing['quantity'] * remaining, component)
                                        await conn.execute("""
                                            INSERT INTO bot_workshop.history_logs (session_id, article, component, qty, source, operation, write_off_session_id, report_date, category)
                                            VALUES ($1, $2, $3, $4, $5, 'write_off_box', $1, $6, $7)
                                        """, session_id, base_article, component, -(ing['quantity'] * remaining), source_log, row['report_date'], row['category'])
                                    details.append(f"Списано {remaining} x {base_article} (ящик)")
                                else:
                                    errors.append(f"Рецепт не знайдено: {base_article}")
                
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


async def _resolve_wholesale_components(conn, article: str, qty: float, skip_finished: bool = False) -> list:
    """
    Розкладає позицію опт-замовлення на резерви по джерелах — та сама каскадна
    логіка, що й run_write_off (finished → cases+recipe / recipe / recipes_lootbox),
    але без жодного фізичного UPDATE.

    skip_finished=True — пропускає резервування з готового (inventory_finished),
    але каскад "кейс-шел (inventory_cases) → рецепт" лишається активним
    (використовується для розподілу "з нуля" в адмінському /wholesale/{id}/source —
    там finished вже явно виділено окремим from_master, а "з нуля" означає
    "не з повністю готового грилю", але порожні кейс-шели все ще валідне джерело).
    """
    SKIP = {'ГРАВІЮВАННЯ ШАМПУРІВ', 'ЧОХОЛ'}
    DIRECT_OPERATIVE = {
        'ЧОХОЛ М': 'Чохол М',
        'ЧОХОЛ В': 'Чохол В',
        'ПИЛЬНИК': 'ПИЛЬНИК',
        'ДОЩЕЧКА': 'дощечка',
    }

    result = []
    raw_article = article.strip().upper()

    if raw_article in SKIP:
        return result

    if raw_article in DIRECT_OPERATIVE:
        result.append({'source_table': 'operative', 'item_id': DIRECT_OPERATIVE[raw_article], 'qty': qty})
        return result

    norm_article = raw_article
    if len(raw_article) <= 5:
        norm_article = raw_article.replace('С', 'S')
    base_article = norm_article
    if not norm_article.startswith('T1'):
        base_article = norm_article.replace('H', '').replace('T', '')

    from_finished = 0
    if not skip_finished:
        finished_row = await conn.fetchrow(
            "SELECT quantity FROM bot_workshop.inventory_finished WHERE item_id = $1", base_article
        )
        finished_qty = finished_row['quantity'] if finished_row else 0
        from_finished = min(finished_qty, qty)

        if from_finished > 0:
            result.append({'source_table': 'finished', 'item_id': base_article, 'qty': from_finished})

    remaining = qty - from_finished
    if remaining <= 0:
        return result

    is_case = await conn.fetchval(
        "SELECT EXISTS(SELECT 1 FROM bot_workshop.inventory_cases WHERE item_id = $1)", norm_article
    )

    if is_case:
        result.append({'source_table': 'cases', 'item_id': norm_article, 'qty': remaining})
        recipe = await conn.fetch(
            "SELECT item_id, quantity FROM bot_workshop.recipes WHERE UPPER(set_id) = $1", base_article
        )
        for ing in recipe:
            result.append({'source_table': 'operative', 'item_id': ing['item_id'], 'qty': ing['quantity'] * remaining})
    else:
        recipe = await conn.fetch(
            "SELECT item_id, quantity FROM bot_workshop.recipes WHERE UPPER(set_id) = $1", base_article
        )
        if recipe:
            for ing in recipe:
                result.append({'source_table': 'operative', 'item_id': ing['item_id'], 'qty': ing['quantity'] * remaining})
        else:
            loot_recipe = await conn.fetch(
                "SELECT item_id, quantity FROM bot_workshop.recipes_lootbox WHERE UPPER(box_id) = $1", base_article
            )
            if not loot_recipe:
                raise ValueError(f"Рецепт не знайдено: {base_article}")
            for ing in loot_recipe:
                result.append({'source_table': 'operative', 'item_id': ing['item_id'], 'qty': ing['quantity'] * remaining})

    return result


@app.post("/api/wholesale/reserve")
async def wholesale_reserve(body: WholesaleReserveBody):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                items_json = json.dumps([item.dict() for item in body.items])
                order_row = await conn.fetchrow("""
                    INSERT INTO bot_workshop.wholesale_orders
                        (source, source_order_id, client_name, phone, items, status, reserved_at)
                    VALUES ($1, $2, $3, $4, $5::jsonb, 'reserved', CURRENT_TIMESTAMP)
                    ON CONFLICT (source, source_order_id) DO NOTHING
                    RETURNING id
                """, body.source, body.source_order_id, body.client_name, body.phone, items_json)

                if not order_row:
                    existing_id = await conn.fetchval("""
                        SELECT id FROM bot_workshop.wholesale_orders
                        WHERE source = $1 AND source_order_id = $2
                    """, body.source, body.source_order_id)
                    return {"status": "already_reserved", "id": existing_id}

                order_id = order_row['id']

                for item in body.items:
                    components = await _resolve_wholesale_components(conn, item.article, item.quantity)
                    for comp in components:
                        await conn.execute("""
                            INSERT INTO bot_workshop.wholesale_reservations
                                (wholesale_order_id, source_table, item_id, reserved_qty, article)
                            VALUES ($1, $2, $3, $4, $5)
                        """, order_id, comp['source_table'], comp['item_id'], comp['qty'], item.article)

        return {"status": "reserved", "id": order_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in POST /api/wholesale/reserve: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/wholesale/writeoff/{wholesale_order_id}")
async def wholesale_writeoff(wholesale_order_id: int):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                order = await conn.fetchrow("""
                    SELECT id, source, source_order_id, status
                    FROM bot_workshop.wholesale_orders WHERE id = $1
                """, wholesale_order_id)
                if not order:
                    raise HTTPException(status_code=404, detail="Опт-замовлення не знайдено")

                if order['status'] == 'written_off':
                    return {"status": "already_written_off", "id": wholesale_order_id}

                reservations = await conn.fetch("""
                    SELECT source_table, item_id, reserved_qty
                    FROM bot_workshop.wholesale_reservations
                    WHERE wholesale_order_id = $1
                """, wholesale_order_id)

                session_id = str(uuid.uuid4())
                article_ref = f"{order['source']}:{order['source_order_id']}"

                for r in reservations:
                    source_table = r['source_table']
                    item_id = r['item_id']
                    qty = r['reserved_qty']

                    if source_table == 'finished':
                        await conn.execute(
                            "UPDATE bot_workshop.inventory_finished SET quantity = quantity - $1 WHERE item_id = $2",
                            qty, item_id
                        )
                    elif source_table == 'finished_main':
                        # Опт-модуль не має поняття гравіювання — списуємо
                        # завжди зі стандартного (is_engraved=true) пулу.
                        await conn.execute(
                            "UPDATE bot_workshop.inventory_finished_main SET quantity = quantity - $1 WHERE item_id = $2 AND is_engraved = true",
                            qty, item_id
                        )
                    elif source_table == 'cases':
                        await conn.execute(
                            "UPDATE bot_workshop.inventory_cases SET quantity = quantity - $1, last_update = CURRENT_TIMESTAMP WHERE item_id = $2",
                            qty, item_id
                        )
                    elif source_table == 'main':
                        await conn.execute(
                            "UPDATE bot_workshop.inventory_main SET quantity = quantity - $1, last_update = CURRENT_TIMESTAMP WHERE item_id = $2",
                            qty, item_id
                        )
                    elif source_table == 'components':
                        await conn.execute(
                            "UPDATE bot_workshop.cases_components SET quantity = quantity - $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2::int",
                            qty, item_id
                        )
                    elif source_table == 'operative':
                        loot_row = await conn.fetchrow(
                            "SELECT item_id FROM bot_workshop.loot_box_operative WHERE item_id = $1", item_id
                        )
                        if loot_row:
                            await conn.execute(
                                "UPDATE bot_workshop.loot_box_operative SET quantity = quantity - $1 WHERE item_id = $2",
                                qty, item_id
                            )
                        else:
                            await conn.execute(
                                "UPDATE bot_workshop.inventory_operative SET quantity = quantity - $1 WHERE item_id = $2",
                                qty, item_id
                            )
                    else:
                        raise ValueError(f"Невідома source_table в резерві: {source_table}")

                    await conn.execute("""
                        INSERT INTO bot_workshop.history_logs (session_id, article, component, qty, source, operation)
                        VALUES ($1, $2, $3, $4, 'wholesale', 'write_off')
                    """, session_id, article_ref, item_id, -qty)

                await conn.execute("""
                    UPDATE bot_workshop.wholesale_orders
                    SET status = 'written_off', written_off_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                """, wholesale_order_id)

                await conn.execute(
                    "DELETE FROM bot_workshop.wholesale_reservations WHERE wholesale_order_id = $1",
                    wholesale_order_id
                )

        return {"status": "written_off", "id": wholesale_order_id, "items_written_off": len(reservations)}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in POST /api/wholesale/writeoff/{wholesale_order_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/wholesale/{wholesale_order_id}/source")
async def set_wholesale_source(wholesale_order_id: int, body: WholesaleSourceBody):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                order = await conn.fetchrow("""
                    SELECT id, items, status FROM bot_workshop.wholesale_orders WHERE id = $1
                """, wholesale_order_id)
                if not order:
                    raise HTTPException(status_code=404, detail="Опт-замовлення не знайдено")
                if order['status'] == 'written_off':
                    raise HTTPException(status_code=400, detail="Замовлення вже списано")

                items = json.loads(order['items'])
                line = next((it for it in items if it.get('article') == body.article), None)
                if not line:
                    raise HTTPException(status_code=404, detail=f"Позицію {body.article} не знайдено в замовленні")
                qty = float(line['quantity'])

                total = body.from_master + body.from_warehouse + body.from_scratch
                if abs(total - qty) > 0.001:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Сума джерел ({total}) не дорівнює кількості позиції ({qty})"
                    )

                if body.from_master > 0:
                    finished_row = await conn.fetchrow(
                        "SELECT quantity FROM bot_workshop.inventory_finished WHERE item_id = $1", body.article
                    )
                    available = finished_row['quantity'] if finished_row else 0
                    if body.from_master > available:
                        raise HTTPException(
                            status_code=400, detail=f"З майстерні перевищує наявність ({available})"
                        )

                if body.from_warehouse > 0:
                    main_row = await conn.fetchrow(
                        "SELECT quantity FROM bot_workshop.inventory_finished_main WHERE item_id = $1 AND is_engraved = true", body.article
                    )
                    available = main_row['quantity'] if main_row else 0
                    if body.from_warehouse > available:
                        raise HTTPException(
                            status_code=400, detail=f"Зі складу перевищує наявність ({available})"
                        )

                if len(items) == 1:
                    # Єдина позиція в замовленні — усі резерви (навіть старі,
                    # без article, з часів до міграції) однозначно належать їй.
                    await conn.execute(
                        "DELETE FROM bot_workshop.wholesale_reservations WHERE wholesale_order_id = $1",
                        wholesale_order_id
                    )
                else:
                    has_legacy = await conn.fetchval("""
                        SELECT EXISTS(
                            SELECT 1 FROM bot_workshop.wholesale_reservations
                            WHERE wholesale_order_id = $1 AND article IS NULL
                        )
                    """, wholesale_order_id)
                    if has_legacy:
                        raise HTTPException(
                            status_code=409,
                            detail="Замовлення має старі резерви без прив'язки до article (кілька позицій у замовленні) — потрібна ручна звірка перед розподілом джерел"
                        )
                    await conn.execute(
                        "DELETE FROM bot_workshop.wholesale_reservations WHERE wholesale_order_id = $1 AND article = $2",
                        wholesale_order_id, body.article
                    )

                if body.from_master > 0:
                    await conn.execute("""
                        INSERT INTO bot_workshop.wholesale_reservations
                            (wholesale_order_id, source_table, item_id, reserved_qty, article)
                        VALUES ($1, 'finished', $2, $3, $2)
                    """, wholesale_order_id, body.article, body.from_master)

                if body.from_warehouse > 0:
                    await conn.execute("""
                        INSERT INTO bot_workshop.wholesale_reservations
                            (wholesale_order_id, source_table, item_id, reserved_qty, article)
                        VALUES ($1, 'finished_main', $2, $3, $2)
                    """, wholesale_order_id, body.article, body.from_warehouse)

                if body.from_scratch > 0:
                    components = await _resolve_wholesale_components(
                        conn, body.article, body.from_scratch, skip_finished=True
                    )
                    for comp in components:
                        await conn.execute("""
                            INSERT INTO bot_workshop.wholesale_reservations
                                (wholesale_order_id, source_table, item_id, reserved_qty, article)
                            VALUES ($1, $2, $3, $4, $5)
                        """, wholesale_order_id, comp['source_table'], comp['item_id'], comp['qty'], body.article)

        return {"status": "ok"}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in POST /api/admin/wholesale/{wholesale_order_id}/source: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/wholesale-overview")
async def get_wholesale_overview():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT
                wr.item_id,
                SUM(wr.reserved_qty) AS reserved,
                COALESCE(m.quantity, 0) + COALESCE(o.quantity, 0) AS available
            FROM bot_workshop.wholesale_reservations wr
            JOIN bot_workshop.wholesale_orders wo ON wo.id = wr.wholesale_order_id
            LEFT JOIN bot_workshop.inventory_main m ON m.item_id = wr.item_id
            LEFT JOIN bot_workshop.inventory_operative o ON o.item_id = wr.item_id
            WHERE wo.status != 'written_off' AND wr.source_table IN ('main', 'operative')
            GROUP BY wr.item_id, m.quantity, o.quantity
            ORDER BY wr.item_id
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/wholesale/items")
async def get_wholesale_items():
    p = await get_pool()
    try:
        orders = await p.fetch("""
            SELECT id, items FROM bot_workshop.wholesale_orders WHERE status != 'written_off'
        """)
        reservations = await p.fetch("""
            SELECT wholesale_order_id, source_table, item_id, reserved_qty, article
            FROM bot_workshop.wholesale_reservations
            WHERE article IS NOT NULL
        """)

        result = []
        for order in orders:
            order_id = order['id']
            items = json.loads(order['items'])
            order_reservations = [r for r in reservations if r['wholesale_order_id'] == order_id]

            for it in items:
                article = it['article']
                qty = float(it['quantity'])
                article_rows = [r for r in order_reservations if r['article'] == article]
                from_master = sum(float(r['reserved_qty']) for r in article_rows if r['source_table'] == 'finished')
                from_warehouse = sum(float(r['reserved_qty']) for r in article_rows if r['source_table'] == 'finished_main')
                has_split = len(article_rows) > 0
                # from_scratch — це кількість ОДИНИЦЬ АРТИКУЛУ, а не сума
                # компонентних резервів (ті множаться на рецепт, напр. Шампур×6),
                # тому це завжди арифметика від qty, а не сума рядків резервів.
                from_scratch = qty - from_master - from_warehouse if has_split else qty

                result.append({
                    "order_id": order_id,
                    "article": article,
                    "qty": qty,
                    "from_master": from_master,
                    "from_warehouse": from_warehouse,
                    "from_scratch": from_scratch,
                })

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/master/wholesale")
async def get_master_wholesale():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT it.article, SUM(it.quantity) AS qty
            FROM bot_workshop.wholesale_orders wo,
                 LATERAL jsonb_to_recordset(wo.items) AS it(article text, quantity numeric)
            WHERE wo.status != 'written_off'
            GROUP BY it.article
            ORDER BY it.article
        """)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pickup/reserve")
async def pickup_reserve(body: PickupReserveBody):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                items_json = json.dumps([item.dict() for item in body.items])
                order_row = await conn.fetchrow("""
                    INSERT INTO bot_workshop.pickup_orders
                        (source, source_order_id, client_name, phone, items, status, reserved_at)
                    VALUES ($1, $2, $3, $4, $5::jsonb, 'reserved', CURRENT_TIMESTAMP)
                    ON CONFLICT (source, source_order_id) DO NOTHING
                    RETURNING id
                """, body.source, body.source_order_id, body.client_name, body.phone, items_json)

                if not order_row:
                    existing_id = await conn.fetchval("""
                        SELECT id FROM bot_workshop.pickup_orders
                        WHERE source = $1 AND source_order_id = $2
                    """, body.source, body.source_order_id)
                    return {"id": existing_id}

                order_id = order_row['id']

                for item in body.items:
                    components = await _resolve_wholesale_components(conn, item.article, item.quantity)
                    for comp in components:
                        await conn.execute("""
                            INSERT INTO bot_workshop.pickup_reservations
                                (pickup_order_id, source_table, item_id, reserved_qty)
                            VALUES ($1, $2, $3, $4)
                        """, order_id, comp['source_table'], comp['item_id'], comp['qty'])

        return {"id": order_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in POST /api/pickup/reserve: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pickup/writeoff/{pickup_order_id}")
async def pickup_writeoff(pickup_order_id: int):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                order = await conn.fetchrow("""
                    SELECT id, source, source_order_id, status
                    FROM bot_workshop.pickup_orders WHERE id = $1
                """, pickup_order_id)
                if not order:
                    raise HTTPException(status_code=404, detail="Самовивіз-замовлення не знайдено")

                if order['status'] == 'written_off':
                    return {"status": "already_written_off", "id": pickup_order_id}

                reservations = await conn.fetch("""
                    SELECT source_table, item_id, reserved_qty
                    FROM bot_workshop.pickup_reservations
                    WHERE pickup_order_id = $1
                """, pickup_order_id)

                session_id = str(uuid.uuid4())
                article_ref = f"{order['source']}:{order['source_order_id']}"

                for r in reservations:
                    source_table = r['source_table']
                    item_id = r['item_id']
                    qty = r['reserved_qty']

                    if source_table == 'finished':
                        await conn.execute(
                            "UPDATE bot_workshop.inventory_finished SET quantity = quantity - $1 WHERE item_id = $2",
                            qty, item_id
                        )
                    elif source_table == 'cases':
                        await conn.execute(
                            "UPDATE bot_workshop.inventory_cases SET quantity = quantity - $1, last_update = CURRENT_TIMESTAMP WHERE item_id = $2",
                            qty, item_id
                        )
                    elif source_table == 'main':
                        await conn.execute(
                            "UPDATE bot_workshop.inventory_main SET quantity = quantity - $1, last_update = CURRENT_TIMESTAMP WHERE item_id = $2",
                            qty, item_id
                        )
                    elif source_table == 'components':
                        await conn.execute(
                            "UPDATE bot_workshop.cases_components SET quantity = quantity - $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2::int",
                            qty, item_id
                        )
                    elif source_table == 'operative':
                        loot_row = await conn.fetchrow(
                            "SELECT item_id FROM bot_workshop.loot_box_operative WHERE item_id = $1", item_id
                        )
                        if loot_row:
                            await conn.execute(
                                "UPDATE bot_workshop.loot_box_operative SET quantity = quantity - $1 WHERE item_id = $2",
                                qty, item_id
                            )
                        else:
                            await conn.execute(
                                "UPDATE bot_workshop.inventory_operative SET quantity = quantity - $1 WHERE item_id = $2",
                                qty, item_id
                            )
                    else:
                        raise ValueError(f"Невідома source_table в резерві: {source_table}")

                    await conn.execute("""
                        INSERT INTO bot_workshop.history_logs (session_id, article, component, qty, source, operation)
                        VALUES ($1, $2, $3, $4, 'pickup', 'write_off')
                    """, session_id, article_ref, item_id, -qty)

                await conn.execute("""
                    UPDATE bot_workshop.pickup_orders
                    SET status = 'written_off', written_off_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                """, pickup_order_id)

                await conn.execute(
                    "DELETE FROM bot_workshop.pickup_reservations WHERE pickup_order_id = $1",
                    pickup_order_id
                )

        return {"status": "written_off", "id": pickup_order_id, "items_written_off": len(reservations)}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in POST /api/pickup/writeoff/{pickup_order_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pickup/release/{pickup_order_id}")
async def pickup_release(pickup_order_id: int):
    p = await get_pool()
    try:
        async with p.acquire() as conn:
            async with conn.transaction():
                order = await conn.fetchrow("""
                    SELECT id, status FROM bot_workshop.pickup_orders WHERE id = $1
                """, pickup_order_id)
                if not order:
                    raise HTTPException(status_code=404, detail="Самовивіз-замовлення не знайдено")

                if order['status'] == 'written_off':
                    raise HTTPException(status_code=400, detail="Замовлення вже списано, звільнення неможливе")

                if order['status'] == 'released':
                    return {"status": "already_released", "id": pickup_order_id}

                await conn.execute(
                    "DELETE FROM bot_workshop.pickup_reservations WHERE pickup_order_id = $1",
                    pickup_order_id
                )

                await conn.execute("""
                    UPDATE bot_workshop.pickup_orders
                    SET status = 'released', released_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                """, pickup_order_id)

        return {"status": "released", "id": pickup_order_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in POST /api/pickup/release/{pickup_order_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/recipes/grills")
async def get_recipes_grills():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT set_id, item_id, quantity
            FROM bot_workshop.recipes
            ORDER BY set_id, item_id
        """)
        grouped: dict = {}
        for r in rows:
            sid = r['set_id']
            if sid not in grouped:
                grouped[sid] = []
            grouped[sid].append({"item_id": r['item_id'], "quantity": r['quantity']})
        return [{"set_id": k, "components": v} for k, v in grouped.items()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/recipes/cases")
async def get_recipes_cases():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT rc.case_sku, rc.component_id, cc.component_name AS item_name, rc.items_per_case
            FROM bot_workshop.recipes_cases rc
            JOIN bot_workshop.cases_components cc ON cc.id = rc.component_id
            ORDER BY rc.case_sku, cc.component_name
        """)
        grouped: dict = {}
        for r in rows:
            sku = r['case_sku']
            if sku not in grouped:
                grouped[sku] = []
            grouped[sku].append({"component_id": r['component_id'], "item_name": r['item_name'], "items_per_case": float(r['items_per_case'])})
        return [{"case_sku": k, "components": v} for k, v in grouped.items()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/recipes/lootbox")
async def get_recipes_lootbox():
    p = await get_pool()
    try:
        rows = await p.fetch("""
            SELECT box_id, item_id, quantity
            FROM bot_workshop.recipes_lootbox
            ORDER BY box_id, item_id
        """)
        grouped: dict = {}
        for r in rows:
            bid = r['box_id']
            if bid not in grouped:
                grouped[bid] = []
            grouped[bid].append({"item_id": r['item_id'], "quantity": r['quantity']})
        return [{"box_id": k, "components": v} for k, v in grouped.items()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RecipeCasePatchBody(BaseModel):
    case_sku: str
    component_id: int
    items_per_case: float


@app.patch("/api/admin/recipes/cases")
async def patch_recipe_case(body: RecipeCasePatchBody):
    p = await get_pool()
    try:
        result = await p.execute("""
            UPDATE bot_workshop.recipes_cases
            SET items_per_case = $1
            WHERE case_sku = $2 AND component_id = $3
        """, body.items_per_case, body.case_sku, body.component_id)
        updated = int(result.split()[-1]) if result else 0
        return {"updated": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RecipeGrillPatchBody(BaseModel):
    set_id: str
    item_id: str
    quantity: int


@app.patch("/api/admin/recipes/grills")
async def patch_recipe_grill(body: RecipeGrillPatchBody):
    p = await get_pool()
    try:
        result = await p.execute("""
            UPDATE bot_workshop.recipes
            SET quantity = $1
            WHERE item_id = $2
              AND set_id ~ ('^' || $3 || '([^0-9]|$)')
        """, body.quantity, body.item_id, body.set_id)
        updated = int(result.split()[-1]) if result else 0
        return {"updated": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RecipeLootboxPatchBody(BaseModel):
    box_id: str
    item_id: str
    quantity: int


@app.patch("/api/admin/recipes/lootbox")
async def patch_recipe_lootbox(body: RecipeLootboxPatchBody):
    p = await get_pool()
    try:
        result = await p.execute("""
            UPDATE bot_workshop.recipes_lootbox
            SET quantity = $1
            WHERE box_id = $2 AND item_id = $3
        """, body.quantity, body.box_id, body.item_id)
        updated = int(result.split()[-1]) if result else 0
        return {"updated": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
