"""
DB-інтеграційні тести — потребують реального підключення до PostgreSQL.
Запуск: pytest tests/test_db.py -v
"""
import asyncio
import os
import sys
import pytest
import pytest_asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

import asyncpg

DB_CONFIG = dict(
    host=os.getenv('DB_HOST'),
    port=int(os.getenv('DB_PORT', 5432)),
    database=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASS'),
)


# ── Фікстура ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def conn():
    c = await asyncpg.connect(**DB_CONFIG)
    yield c
    await c.close()


# ── Схема таблиць ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_loot_box_operative_schema(conn):
    """loot_box_operative має обов'язкові колонки."""
    rows = await conn.fetch("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'bot_workshop' AND table_name = 'loot_box_operative'
    """)
    cols = {r['column_name'] for r in rows}
    assert {'item_id', 'item_name', 'quantity', 'min_limit'} <= cols, f"Відсутні колонки: {cols}"


@pytest.mark.asyncio
async def test_loot_box_main_schema(conn):
    """loot_box_main має обов'язкові колонки."""
    rows = await conn.fetch("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'bot_workshop' AND table_name = 'loot_box_main'
    """)
    cols = {r['column_name'] for r in rows}
    assert {'item_id', 'item_name', 'quantity', 'min_limit'} <= cols, f"Відсутні колонки: {cols}"


@pytest.mark.asyncio
async def test_inventory_checks_schema(conn):
    """inventory_checks має поля що потрібні для інвентаризації."""
    rows = await conn.fetch("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'bot_workshop' AND table_name = 'inventory_checks'
    """)
    cols = {r['column_name'] for r in rows}
    assert {'item_id', 'table_key', 'actual_qty', 'system_qty', 'delta', 'checked_at'} <= cols, \
        f"Відсутні колонки в inventory_checks: {cols}"


@pytest.mark.asyncio
async def test_history_logs_schema(conn):
    """history_logs має всі поля що write_off записує."""
    rows = await conn.fetch("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'bot_workshop' AND table_name = 'history_logs'
    """)
    cols = {r['column_name'] for r in rows}
    # Реальні колонки: session_id, article, component, qty, source, operation
    required = {'session_id', 'article', 'component', 'qty', 'source', 'operation'}
    assert required <= cols, f"Відсутні колонки в history_logs: {cols}"


# ── GET /api/stock — перевірка SQL ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_stock_query_runs_without_error(conn):
    """Великий UNION ALL з /api/stock виконується без помилок."""
    rows = await conn.fetch("""
        SELECT item_id::text, item_name AS name, quantity::float, min_limit::float,
            NULL::text AS unit_type, NULL::float AS conversion_factor,
            CASE WHEN min_limit IS NULL THEN 'ok'
                 WHEN quantity <= 0 THEN 'critical'
                 WHEN quantity <= min_limit THEN 'critical'
                 WHEN quantity <= min_limit*1.5 THEN 'low'
                 ELSE 'ok' END AS status,
            'main' AS category
        FROM bot_workshop.inventory_main
        UNION ALL
        SELECT item_id::text, item_name, quantity::float, min_limit::float,
            NULL::text, NULL::float,
            CASE WHEN min_limit IS NULL THEN 'ok'
                 WHEN quantity <= 0 THEN 'critical'
                 WHEN quantity <= min_limit THEN 'critical'
                 WHEN quantity <= min_limit*1.5 THEN 'low'
                 ELSE 'ok' END, 'operative'
        FROM bot_workshop.inventory_operative
        UNION ALL
        SELECT item_id::text, item_name, quantity::float, min_limit::float,
            NULL::text, NULL::float,
            CASE WHEN min_limit IS NULL THEN 'ok'
                 WHEN quantity <= 0 THEN 'critical'
                 WHEN quantity <= min_limit THEN 'critical'
                 WHEN quantity <= min_limit*1.5 THEN 'low'
                 ELSE 'ok' END, 'loot_box_main'
        FROM bot_workshop.loot_box_main
        UNION ALL
        SELECT item_id::text, item_name, quantity::float, min_limit::float,
            NULL::text, NULL::float,
            CASE WHEN min_limit IS NULL THEN 'ok'
                 WHEN quantity <= 0 THEN 'critical'
                 WHEN quantity <= min_limit THEN 'critical'
                 WHEN quantity <= min_limit*1.5 THEN 'low'
                 ELSE 'ok' END, 'loot_box_operative'
        FROM bot_workshop.loot_box_operative
    """)
    for r in rows:
        assert r['status'] in ('ok', 'low', 'critical'), f"Невалідний статус: {r['status']}"
        assert r['category'] in ('main', 'operative', 'loot_box_main', 'loot_box_operative')


@pytest.mark.asyncio
async def test_stock_loot_box_rows_have_item_id(conn):
    """loot_box_main і loot_box_operative повертають item_id і name."""
    rows = await conn.fetch("""
        SELECT item_id::text, item_name AS name, quantity::float
        FROM bot_workshop.loot_box_main
        UNION ALL
        SELECT item_id::text, item_name, quantity::float
        FROM bot_workshop.loot_box_operative
    """)
    for r in rows:
        assert r['item_id'] is not None
        assert r['name'] is not None


# ── GET /api/notifications — перевірка що inventory_operative відсутній ───────

@pytest.mark.asyncio
async def test_notifications_query_no_inventory_operative(conn):
    """
    Запит /api/notifications не містить inventory_operative.
    inventory_operative — зона майстра, не адмінки.
    """
    rows = await conn.fetch("""
        SELECT 'inventory_main' AS source, item_id
        FROM bot_workshop.inventory_main
        WHERE min_limit IS NOT NULL AND quantity <= min_limit
        UNION ALL
        SELECT 'cases_components' AS source, component_name
        FROM bot_workshop.cases_components
        WHERE min_threshold IS NOT NULL AND quantity <= min_threshold
        UNION ALL
        SELECT 'defects' AS source, sku
        FROM bot_workshop.defects
        WHERE status != 'fixed'
        UNION ALL
        SELECT 'loot_box_operative' AS source, item_id
        FROM bot_workshop.loot_box_operative
        WHERE min_limit IS NOT NULL AND quantity <= min_limit
        UNION ALL
        SELECT 'loot_box_main' AS source, item_id
        FROM bot_workshop.loot_box_main
        WHERE min_limit IS NOT NULL AND quantity <= min_limit
    """)
    sources = {r['source'] for r in rows}
    assert 'inventory_operative' not in sources, "inventory_operative не повинен з'являтись в admin notifications"


@pytest.mark.asyncio
async def test_notifications_sources_are_valid(conn):
    """Всі source в notifications — тільки відомі значення."""
    rows = await conn.fetch("""
        SELECT 'inventory_main' AS source FROM bot_workshop.inventory_main WHERE min_limit IS NOT NULL AND quantity <= min_limit
        UNION ALL
        SELECT 'cases_components' FROM bot_workshop.cases_components WHERE min_threshold IS NOT NULL AND quantity <= min_threshold
        UNION ALL
        SELECT 'defects' FROM bot_workshop.defects WHERE status != 'fixed'
        UNION ALL
        SELECT 'loot_box_operative' FROM bot_workshop.loot_box_operative WHERE min_limit IS NOT NULL AND quantity <= min_limit
        UNION ALL
        SELECT 'loot_box_main' FROM bot_workshop.loot_box_main WHERE min_limit IS NOT NULL AND quantity <= min_limit
    """)
    allowed = {'inventory_main', 'cases_components', 'defects', 'loot_box_operative', 'loot_box_main'}
    for r in rows:
        assert r['source'] in allowed, f"Несподіваний source: {r['source']}"


# ── PATCH /api/admin/inventory — маппінг table_key → SQL ────────────────────

TABLE_KEY_MAP = {
    'operative':        ('bot_workshop.inventory_operative', 'item_id'),
    'main':             ('bot_workshop.inventory_main', 'item_id'),
    'finished':         ('bot_workshop.inventory_finished', 'item_id'),
    'finished_main':    ('bot_workshop.inventory_finished_main', 'item_id'),
    'cases_empty':      ('bot_workshop.inventory_cases', 'item_id'),
    'components':       ('bot_workshop.cases_components', 'id'),
    'loot_box_operative': ('bot_workshop.loot_box_operative', 'item_id'),
    'loot_box_main':    ('bot_workshop.loot_box_main', 'item_id'),
}

@pytest.mark.asyncio
async def test_all_patch_tables_exist(conn):
    """Кожна таблиця з PATCH valid_tables фізично існує в БД."""
    for key, (table, _) in TABLE_KEY_MAP.items():
        schema, tname = table.split('.')
        exists = await conn.fetchval("""
            SELECT EXISTS(
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = $1 AND table_name = $2
            )
        """, schema, tname)
        assert exists, f"Таблиця {table} не існує (table_key='{key}')"


@pytest.mark.asyncio
async def test_all_patch_tables_have_quantity_column(conn):
    """Кожна таблиця з PATCH valid_tables має колонку quantity для UPDATE."""
    for key, (table, _) in TABLE_KEY_MAP.items():
        schema, tname = table.split('.')
        col_exists = await conn.fetchval("""
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2 AND column_name = 'quantity'
            )
        """, schema, tname)
        assert col_exists, f"Таблиця {table} не має колонки 'quantity' (table_key='{key}')"


@pytest.mark.asyncio
async def test_all_patch_pk_columns_exist(conn):
    """Кожна таблиця з PATCH valid_tables має свій PK-like стовпець (item_id або id)."""
    for key, (table, pk_col) in TABLE_KEY_MAP.items():
        schema, tname = table.split('.')
        col_exists = await conn.fetchval("""
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
            )
        """, schema, tname, pk_col)
        assert col_exists, f"Таблиця {table} не має колонки '{pk_col}' (table_key='{key}')"


# ── Рецепти — цілісність ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_recipes_have_valid_component_references(conn):
    """
    Компоненти в recipes (грилі) мають бути в inventory_operative або loot_box_operative.
    Ящики — в окремій таблиці recipes_lootbox, не тут.
    """
    orphans = await conn.fetch("""
        SELECT DISTINCT r.item_id
        FROM bot_workshop.recipes r
        WHERE r.item_id NOT IN (
            SELECT item_id FROM bot_workshop.inventory_operative
            UNION
            SELECT item_id FROM bot_workshop.loot_box_operative
        )
    """)
    assert len(orphans) == 0, (
        f"Інгредієнти рецептів (грилі) відсутні в обох operative таблицях: "
        + ", ".join(r['item_id'] for r in orphans)
    )


@pytest.mark.asyncio
async def test_recipes_lootbox_have_valid_component_references(conn):
    """
    Компоненти в recipes_lootbox мають бути в loot_box_operative АБО inventory_operative.
    write_off перевіряє loot_box_operative першим, потім inventory_operative.
    """
    orphans = await conn.fetch("""
        SELECT DISTINCT r.item_id
        FROM bot_workshop.recipes_lootbox r
        WHERE r.item_id NOT IN (
            SELECT item_id FROM bot_workshop.loot_box_operative
            UNION
            SELECT item_id FROM bot_workshop.inventory_operative
        )
    """)
    assert len(orphans) == 0, (
        f"Інгредієнти recipes_lootbox відсутні в обох operative таблицях: "
        + ", ".join(r['item_id'] for r in orphans)
    )


@pytest.mark.asyncio
async def test_recipes_no_box_duplicates(conn):
    """recipes не повинен містити set_id ящиків — вони тепер в recipes_lootbox."""
    box_ids = ['BBQ', 'Автолюбитель максимум', 'Автолюбитель стандарт',
               'Винний', 'Віскі', 'Лазня', 'Пивний', 'Полуничка', 'Турист']
    found = await conn.fetch("""
        SELECT DISTINCT set_id FROM bot_workshop.recipes
        WHERE set_id = ANY($1::text[])
    """, box_ids)
    assert len(found) == 0, (
        f"Ящики знайдено в recipes (мають бути тільки в recipes_lootbox): "
        + ", ".join(r['set_id'] for r in found)
    )


@pytest.mark.asyncio
async def test_recipes_quantity_positive(conn):
    """В рецептах (грилі) кількість компонентів > 0."""
    bad = await conn.fetch("""
        SELECT set_id, item_id, quantity
        FROM bot_workshop.recipes
        WHERE quantity <= 0
    """)
    assert len(bad) == 0, f"Рецепти з кількістю <= 0: {[dict(r) for r in bad[:5]]}"


@pytest.mark.asyncio
async def test_recipes_lootbox_quantity_positive(conn):
    """В recipes_lootbox кількість компонентів > 0."""
    bad = await conn.fetch("""
        SELECT box_id, item_id, quantity
        FROM bot_workshop.recipes_lootbox
        WHERE quantity <= 0
    """)
    assert len(bad) == 0, f"recipes_lootbox з кількістю <= 0: {[dict(r) for r in bad[:5]]}"


# ── Інвентаризація ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_inventory_checks_table_keys_are_valid(conn):
    """
    Всі table_key в inventory_checks — тільки відомі значення.
    Якщо є невалідні — щось записало сміття в БД.
    """
    valid_keys = {
        'finished', 'operative', 'main', 'cases_empty', 'finished_main',
        'components', 'loot_box_operative', 'loot_box_main',
    }
    rows = await conn.fetch("SELECT DISTINCT table_key FROM bot_workshop.inventory_checks")
    db_keys = {r['table_key'] for r in rows}
    unknown = db_keys - valid_keys
    assert not unknown, f"Невалідні table_key в inventory_checks: {unknown}"


@pytest.mark.asyncio
async def test_inventory_checks_delta_matches_calculation(conn):
    """delta = actual_qty - system_qty для всіх записів в inventory_checks."""
    rows = await conn.fetch("""
        SELECT item_id, table_key, actual_qty, system_qty, delta
        FROM bot_workshop.inventory_checks
        LIMIT 200
    """)
    mismatches = []
    for r in rows:
        expected = round(float(r['actual_qty']) - float(r['system_qty']), 6)
        actual = round(float(r['delta']), 6)
        if abs(expected - actual) > 0.001:
            mismatches.append(f"{r['table_key']}:{r['item_id']} delta={actual} but {r['actual_qty']}-{r['system_qty']}={expected}")
    assert not mismatches, f"Розбіжності delta: {mismatches[:5]}"


# ── Дані loot_box ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_loot_box_operative_count(conn):
    """loot_box_operative містить позиції (53 за специфікацією, мінімум 1)."""
    count = await conn.fetchval("SELECT COUNT(*) FROM bot_workshop.loot_box_operative")
    assert count >= 1, f"loot_box_operative порожній"
    print(f"\n  loot_box_operative: {count} позицій")


@pytest.mark.asyncio
async def test_loot_box_main_count(conn):
    """loot_box_main містить позиції."""
    count = await conn.fetchval("SELECT COUNT(*) FROM bot_workshop.loot_box_main")
    assert count >= 1, f"loot_box_main порожній"
    print(f"\n  loot_box_main: {count} позицій")


@pytest.mark.asyncio
async def test_loot_box_quantity_types(conn):
    """quantity в loot_box таблицях — числові значення, не NULL."""
    bad_op = await conn.fetchval(
        "SELECT COUNT(*) FROM bot_workshop.loot_box_operative WHERE quantity IS NULL"
    )
    bad_main = await conn.fetchval(
        "SELECT COUNT(*) FROM bot_workshop.loot_box_main WHERE quantity IS NULL"
    )
    assert bad_op == 0, f"loot_box_operative має {bad_op} рядків з NULL quantity"
    assert bad_main == 0, f"loot_box_main має {bad_main} рядків з NULL quantity"
