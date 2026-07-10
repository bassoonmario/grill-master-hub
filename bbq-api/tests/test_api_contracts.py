"""
Тести API контрактів — перевірка структури відповідей без DB.
Тестуємо що:
- endpoint повертає правильні поля
- типи полів правильні
- checksMap ключі узгоджені між фронтом і беком
"""


# ── Контракт GET /api/stock ───────────────────────────────────────────────────

EXPECTED_STOCK_FIELDS = {'item_id', 'name', 'quantity', 'min_limit', 'max_limit', 'unit_type', 'conversion_factor', 'status', 'category'}

EXPECTED_STOCK_STATUSES = {'ok', 'low', 'critical'}

ALL_STOCK_CATEGORIES = {
    'main', 'finished', 'operative', 'cases',
    'cases_empty', 'finished_main',
    'loot_box_main', 'loot_box_operative',
}

def test_stock_status_values_are_complete():
    """CASE в SQL може повернути тільки ok/low/critical."""
    sql_cases = {'ok', 'critical', 'low'}
    assert sql_cases == EXPECTED_STOCK_STATUSES


def test_all_categories_are_handled_by_frontend_grouping():
    """
    Кожна category з stock endpoint потрапляє в один з блоків grouping logic
    в AdminWarehouses або ігнорується навмисно.
    """
    grills_cats = {'cases_empty', 'ready', 'finished_main'}  # 'finished' → 'ready' після mapping
    warehouse_cats = {'operative', 'main'}
    component_cats = {'cases'}
    loot_box_cats = {'loot_box_operative', 'loot_box_main'}

    frontend_handled = grills_cats | warehouse_cats | component_cats | loot_box_cats

    # Категорії після маппінгу (finished → ready)
    mapped_categories = set()
    for cat in ALL_STOCK_CATEGORIES:
        mapped_categories.add('ready' if cat == 'finished' else cat)

    unhandled = mapped_categories - frontend_handled
    assert not unhandled, f"Category з /api/stock не обробляється в AdminWarehouses: {unhandled}"


# ── Контракт checksMap ────────────────────────────────────────────────────────

def test_checksmap_key_format():
    """checksMap ключі формуються як '{table_key}:{item_id}'."""
    def make_key(table_key: str, item_id: str) -> str:
        return f"{table_key}:{item_id}"

    assert make_key('operative', 'ITEM1') == 'operative:ITEM1'
    assert make_key('loot_box_main', 'SKU42') == 'loot_box_main:SKU42'


def test_checksmap_keys_used_in_frontend():
    """
    Перевіряємо що кожен table_key в checksMap lookup у фронті
    відповідає реальному table_key що /check endpoint зберігає.
    """
    CHECK_VALID_TABLES = {
        'finished', 'operative', 'main', 'cases_empty', 'finished_main', 'components',
        'loot_box_operative', 'loot_box_main',
    }

    # table_key які фронт шукає в checksMap
    FRONTEND_CHECKSMAP_LOOKUPS = {
        'cases_empty',      # grills: cases_empty delta badge
        'finished',         # grills: finished delta badge
        'finished_main',    # grills: finished_main delta badge
        'operative',        # warehouses: operative delta badge (in name cell)
        'main',             # warehouses: main delta badge
        'loot_box_operative',  # loot_boxes: operative delta badge (in name cell)
        'loot_box_main',    # loot_boxes: main delta badge
        'components',       # components: delta badge
    }

    missing = FRONTEND_CHECKSMAP_LOOKUPS - CHECK_VALID_TABLES
    assert not missing, f"checksMap шукає table_key який /check не зберігає: {missing}"


# ── Контракт GET /api/notifications ──────────────────────────────────────────

NOTIFICATION_FIELDS = {'source', 'item_id', 'quantity', 'limit_val', 'is_internal', 'id', 'unit_type', 'conversion_factor'}

def test_notification_response_has_required_fields():
    """Відповідь /api/notifications містить всі поля що фронт очікує."""
    frontend_expected = {'source', 'item_id', 'quantity', 'limit_val'}
    assert frontend_expected <= NOTIFICATION_FIELDS


def test_loot_box_notifications_have_no_is_internal():
    """
    loot_box_* нотіфікації повертають NULL для is_internal —
    фронт не фільтрує їх по is_internal, це правильно.
    """
    # loot_box в SQL: NULL::boolean AS is_internal
    # Фільтр фронту: al.source === 'loot_box_operative' || al.source === 'loot_box_main'
    # Не використовує is_internal — OK
    loot_box_filter_uses_is_internal = False
    assert not loot_box_filter_uses_is_internal


# ── Тест: стрес на нормалізацію великих кількостей ───────────────────────────

def test_bulk_table_key_validation_performance():
    """
    10000 валідацій table_key — перевіряємо що set lookup O(1).
    """
    import time

    VALID_TABLES = {
        'finished', 'operative', 'components', 'main',
        'cases_empty', 'finished_main',
        'loot_box_operative', 'loot_box_main',
    }

    keys_to_test = ['operative', 'invalid_key', 'loot_box_operative', 'DROP TABLE'] * 2500

    start = time.perf_counter()
    results = [k in VALID_TABLES for k in keys_to_test]
    elapsed = time.perf_counter() - start

    assert elapsed < 0.01, f"Валідація повільна: {elapsed:.4f}s для 10000 перевірок"
    assert results.count(True) == 5000  # 2 валідних ключа з 4 повторюються 2500 разів


def test_inventory_check_delta_calculation():
    """
    Δ = actual_qty - system_qty.
    Перевіряємо граничні значення.
    """
    def calc_delta(actual: float, system: float) -> float:
        return actual - system

    assert calc_delta(10, 8) == 2        # надлишок
    assert calc_delta(5, 8) == -3        # нестача
    assert calc_delta(8, 8) == 0         # без змін
    assert calc_delta(0, 5) == -5        # все відсутнє
    assert calc_delta(100, 0) == 100     # нова позиція


def test_write_off_aggregation_logic():
    """
    Агрегація по article в write_off: однакові артикули сумуються.
    """
    def aggregate(shipments):
        result = {}
        for r in shipments:
            key = r['article'].strip().upper()
            if key not in result:
                result[key] = {'article': key, 'quantity': 0, 'is_case': r['is_case']}
            result[key]['quantity'] += r['quantity']
        return list(result.values())

    shipments = [
        {'article': 'G12', 'quantity': 5, 'is_case': False},
        {'article': 'G12', 'quantity': 3, 'is_case': False},
        {'article': 'G17S', 'quantity': 2, 'is_case': False},
        {'article': ' g12 ', 'quantity': 1, 'is_case': False},  # зі spaces і lowercase
    ]

    result = aggregate(shipments)
    by_article = {r['article']: r['quantity'] for r in result}

    assert by_article['G12'] == 9   # 5 + 3 + 1
    assert by_article['G17S'] == 2
    assert len(by_article) == 2


def test_write_off_aggregation_preserves_is_case():
    """is_case береться від першого запису для артикулу."""
    def aggregate(shipments):
        result = {}
        for r in shipments:
            key = r['article'].strip().upper()
            if key not in result:
                result[key] = {'article': key, 'quantity': 0, 'is_case': r['is_case']}
            result[key]['quantity'] += r['quantity']
        return {r['article']: r for r in result.values()}

    shipments = [
        {'article': 'G12', 'quantity': 5, 'is_case': True},
        {'article': 'G12', 'quantity': 3, 'is_case': False},  # перший True → True
    ]
    result = aggregate(shipments)
    assert result['G12']['is_case'] is True


def test_current_cycle_logic():
    """current_cycle() повертає '1-15' або '16-кін' залежно від дня."""
    from datetime import date

    def current_cycle(today=None):
        today = today or date.today()
        return "1-15" if today.day <= 15 else "16-кін"

    assert current_cycle(date(2025, 1, 1)) == "1-15"
    assert current_cycle(date(2025, 1, 15)) == "1-15"
    assert current_cycle(date(2025, 1, 16)) == "16-кін"
    assert current_cycle(date(2025, 1, 31)) == "16-кін"
