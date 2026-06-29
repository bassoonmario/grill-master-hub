"""
Static consistency tests — no DB, no mocking.
Перевіряє що фронт і бек узгоджені між собою по ключових контрактах.
"""

# ── Дані з бекенду (main.py) ──────────────────────────────────────────────────

PATCH_VALID_TABLES = {
    'finished', 'operative', 'components', 'main',
    'cases_empty', 'finished_main',
    'loot_box_operative', 'loot_box_main',
}

CHECK_VALID_TABLES = {
    'finished', 'operative', 'main', 'cases_empty', 'finished_main', 'components',
    'loot_box_operative', 'loot_box_main',
}

BACKEND_STOCK_CATEGORIES = {
    'main', 'finished', 'operative', 'cases',
    'cases_empty', 'finished_main',
    'loot_box_main', 'loot_box_operative',
}

# inventory_operative свідомо відсутній — він для кабінету майстра, не для адмінки
BACKEND_NOTIFICATION_SOURCES = {
    'inventory_main', 'cases_components', 'defects',
    'loot_box_operative', 'loot_box_main',
}

# ── Дані з фронтенду (api.ts + AdminWarehouses.tsx + AdminDashboard.tsx) ──────

FRONTEND_UPDATE_INVENTORY_KEYS = {
    'cases_empty', 'finished', 'finished_main',
    'loot_box_main', 'loot_box_operative',
    'main', 'operative',
}

FRONTEND_OPEN_CHECK_KEYS = {
    'cases_empty', 'finished', 'finished_main',
    'operative', 'main',
    'loot_box_operative', 'loot_box_main',
    'components',
}

FRONTEND_STOCK_CATEGORY_TYPE = {
    'main', 'ready', 'operative', 'cases',
    'cases_empty', 'finished_main', 'finished',
    'loot_box_operative', 'loot_box_main',
}

FRONTEND_FORMAT_SOURCE_CASES = {
    'inventory_main', 'inventory_operative',
    'cases_components', 'defects',
    'loot_box_operative', 'loot_box_main',
}

FRONTEND_ALERT_FILTER_SOURCES = {
    'inventory_main',
    'cases_components',   # фільтрується по is_internal
    'loot_box_operative',
    'loot_box_main',
}


# ── Тести ─────────────────────────────────────────────────────────────────────

def test_frontend_update_inventory_keys_in_backend_patch():
    """Кожен table_key що фронт відправляє в updateInventory → є у valid_tables PATCH."""
    missing = FRONTEND_UPDATE_INVENTORY_KEYS - PATCH_VALID_TABLES
    assert not missing, f"Фронт відправляє table_key яких немає в PATCH valid_tables: {missing}"


def test_frontend_open_check_keys_in_backend_check():
    """Кожен table_key що фронт відправляє в openCheck → є у valid_tables /check."""
    missing = FRONTEND_OPEN_CHECK_KEYS - CHECK_VALID_TABLES
    assert not missing, f"openCheck відправляє table_key яких немає в /check valid_tables: {missing}"


def test_backend_stock_categories_in_frontend_type():
    """Кожна category з GET /api/stock після маппінгу ('finished'→'ready') є у StockItem.category."""
    mapped = set()
    for cat in BACKEND_STOCK_CATEGORIES:
        mapped.add('ready' if cat == 'finished' else cat)
    missing = mapped - FRONTEND_STOCK_CATEGORY_TYPE
    assert not missing, f"Backend повертає category яких немає в StockItem type: {missing}"


def test_backend_notification_sources_in_frontend_format_source():
    """Кожен source з GET /api/notifications має case у formatSource."""
    missing = BACKEND_NOTIFICATION_SOURCES - FRONTEND_FORMAT_SOURCE_CASES
    assert not missing, f"Backend повертає source без case у formatSource: {missing}"


def test_backend_notification_sources_covered_by_alert_filters():
    """
    Кожен не-defects source з notifications потрапляє хоча б в один фільтр алярмів.
    'defects' навмисно не відображається в акордеонах (окремий виджет).
    """
    unhandled = BACKEND_NOTIFICATION_SOURCES - FRONTEND_ALERT_FILTER_SOURCES - {'defects'}
    assert not unhandled, f"Sources що не потрапляють ні в який акордеон: {unhandled}"


def test_inventory_operative_intentionally_absent_from_admin_notifications():
    """
    inventory_operative свідомо виключений з /api/notifications адмінки.
    Буфер цеху (inventory_operative) — зона відповідальності кабінету майстра.
    """
    assert 'inventory_operative' not in BACKEND_NOTIFICATION_SOURCES
    assert 'inventory_operative' not in FRONTEND_ALERT_FILTER_SOURCES


def test_no_orphan_patch_valid_tables():
    """Жоден table_key з PATCH valid_tables не є зайвим — фронт його реально використовує."""
    # 'components' використовується тільки через ReplenishModal, не через updateInventory
    expected_unused = {'components'}
    orphans = PATCH_VALID_TABLES - FRONTEND_UPDATE_INVENTORY_KEYS - expected_unused
    assert not orphans, f"PATCH valid_tables містить table_key який фронт не відправляє: {orphans}"


def test_check_valid_tables_superset_of_patch():
    """Всі table_key з PATCH теж підтримуються в /check (інвентаризація повинна працювати для всіх)."""
    # 'components' і loot_box є в обох — перевіряємо що /check не менш повний ніж PATCH
    missing_in_check = PATCH_VALID_TABLES - CHECK_VALID_TABLES
    assert not missing_in_check, f"table_key є в PATCH але не в /check: {missing_in_check}"
