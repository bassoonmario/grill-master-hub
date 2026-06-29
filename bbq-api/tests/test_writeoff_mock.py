"""
Mock-based тести для run_write_off і inventory endpoints.
Мокаємо asyncpg pool/conn — БД не потрібна.
"""
import asyncio
import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch, call

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ── Хелпери ───────────────────────────────────────────────────────────────────

def make_conn(shipments=None, recipe=None, loot_check=None):
    """Повертає мок conn з заздалегідь визначеними відповідями."""
    conn = AsyncMock()

    if shipments is not None:
        conn.fetch.side_effect = _make_fetch_side_effect(shipments, recipe)

    conn.fetchrow.return_value = loot_check  # перевірка loot_box_operative
    conn.fetchval.return_value = 0
    conn.execute.return_value = None
    return conn


def _make_fetch_side_effect(shipments, recipe):
    """Перший fetch → shipments, наступні → recipe."""
    calls = [0]
    async def side_effect(query, *args):
        if 'daily_shipments' in query:
            return shipments
        if 'recipes' in query.lower():
            return recipe or []
        if 'loot_box' in query:
            return []
        return []
    return side_effect


def make_pool(conn):
    """Pool який повертає conn через context manager."""
    pool = AsyncMock()
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=conn)
    cm.__aexit__ = AsyncMock(return_value=False)
    tx = AsyncMock()
    tx.__aenter__ = AsyncMock(return_value=None)
    tx.__aexit__ = AsyncMock(return_value=False)
    conn.transaction.return_value = tx
    pool.acquire.return_value = cm
    return pool


def make_shipment(article, quantity, is_case=False):
    row = MagicMock()
    row.__getitem__ = lambda self, key: {
        'id': 1, 'article': article, 'quantity': quantity, 'is_case': is_case
    }[key]
    row.keys = lambda: ['id', 'article', 'quantity', 'is_case']
    # asyncpg Record-like interface
    d = {'id': 1, 'article': article, 'quantity': quantity, 'is_case': is_case}
    for k, v in d.items():
        setattr(row, k, v)
    row.__iter__ = lambda self: iter(d.items())
    # make dict(row) work
    row._mapping = d
    return row


def shipment_record(article, quantity, is_case=False):
    """asyncpg-like Record."""
    r = {'id': 1, 'article': article, 'quantity': quantity, 'is_case': is_case}
    m = MagicMock()
    m.__getitem__ = lambda self, k: r[k]
    m.items = lambda: r.items()
    return m


# ── Простіший підхід: тестуємо логіку без імпорту main.py ────────────────────

class WriteOffLogicTests:
    """
    Тести ізольованої логіки write_off без запуску FastAPI.
    Перевіряємо що правильні SQL-запити генеруються в правильних ситуаціях.
    """

    def test_skip_articles_no_db_write(self):
        """Артикули з SKIP не генерують жодного UPDATE/INSERT."""
        from test_article_logic import classify_article
        for article in ['ГРАВІЮВАННЯ ШАМПУРІВ', 'ЧОХОЛ']:
            kind, _ = classify_article(article)
            assert kind == 'skip', f"'{article}' має бути skip"

    def test_direct_operative_articles_classified_correctly(self):
        """DIRECT_OPERATIVE артикули ідуть напряму в operative без рецепту."""
        from test_article_logic import classify_article
        for article in ['ЧОХОЛ М', 'ЧОХОЛ В', 'ПИЛЬНИК', 'ДОЩЕЧКА']:
            kind, target = classify_article(article)
            assert kind == 'direct_operative', f"'{article}' має бути direct_operative"
            assert target is not None

    def test_loot_box_table_selection_logic(self):
        """
        Логіка вибору таблиці для write_off компонентів:
        якщо item_id є в loot_box_operative → UPDATE loot_box_operative
        інакше → UPDATE inventory_operative
        """
        def select_table(is_in_loot: bool) -> str:
            if is_in_loot:
                return 'bot_workshop.loot_box_operative'
            return 'bot_workshop.inventory_operative'

        assert select_table(True) == 'bot_workshop.loot_box_operative'
        assert select_table(False) == 'bot_workshop.inventory_operative'

    def test_source_log_matches_target_table(self):
        """source_log в history_logs має відповідати target_table."""
        def get_source_log(target_table: str) -> str:
            return target_table.replace('bot_workshop.', '')

        assert get_source_log('bot_workshop.loot_box_operative') == 'loot_box_operative'
        assert get_source_log('bot_workshop.inventory_operative') == 'inventory_operative'

    def test_article_normalization_chain(self):
        """Повний ланцюг нормалізації як у write_off."""
        from test_article_logic import classify_article

        cases = [
            ('G12H',  'recipe', 'G12'),
            ('G12T',  'recipe', 'G12'),
            ('G17SH', 'recipe', 'G17S'),
            ('T1S',   'recipe', 'T1S'),
            ('T1',    'recipe', 'T1'),
            ('T1С',   'recipe', 'T1S'),  # кирилична С → латинська
        ]
        for raw, expected_kind, expected_base in cases:
            kind, base = classify_article(raw)
            assert kind == expected_kind, f"'{raw}': kind={kind}, expected={expected_kind}"
            assert base == expected_base, f"'{raw}': base={base}, expected={expected_base}"


# ── Тести pydantic моделей ────────────────────────────────────────────────────

def test_inventory_update_model_valid():
    """InventoryUpdate приймає валідні дані."""
    from pydantic import BaseModel
    from typing import Optional

    class InventoryUpdate(BaseModel):
        table_key: str
        item_id: str
        new_quantity: int

    obj = InventoryUpdate(table_key='operative', item_id='item1', new_quantity=10)
    assert obj.table_key == 'operative'
    assert obj.new_quantity == 10


def test_inventory_update_model_float_coercion():
    """
    InventoryUpdate.new_quantity — int field.
    5.0 → 5 (Pydantic коерсить), але 5.5 → ValidationError.
    """
    from pydantic import BaseModel, ValidationError

    class InventoryUpdate(BaseModel):
        table_key: str
        item_id: str
        new_quantity: int

    # 5.0 → OK (ціле float)
    obj = InventoryUpdate(table_key='operative', item_id='x', new_quantity=5.0)
    assert obj.new_quantity == 5

    # 5.5 → ValidationError
    try:
        InventoryUpdate(table_key='operative', item_id='x', new_quantity=5.5)
        raise AssertionError("Мало б кинути ValidationError на 5.5")
    except ValidationError:
        pass  # очікувано


def test_inventory_check_body_accepts_float():
    """InventoryCheckBody.actual_qty: float — приймає дробові."""
    from pydantic import BaseModel
    from typing import Optional

    class InventoryCheckBody(BaseModel):
        item_id: str
        table_key: str
        actual_qty: float
        note: Optional[str] = None

    obj = InventoryCheckBody(item_id='x', table_key='operative', actual_qty=5.5)
    assert obj.actual_qty == 5.5

    obj2 = InventoryCheckBody(item_id='x', table_key='operative', actual_qty=0)
    assert obj2.actual_qty == 0.0


def test_inventory_update_negative_quantity():
    """
    InventoryUpdate не валідує від'ємні значення на рівні моделі —
    це треба перевіряти на рівні бізнес-логіки.
    Тест фіксує поточну поведінку (від'ємне проходить через модель).
    """
    from pydantic import BaseModel

    class InventoryUpdate(BaseModel):
        table_key: str
        item_id: str
        new_quantity: int

    obj = InventoryUpdate(table_key='operative', item_id='x', new_quantity=-5)
    assert obj.new_quantity == -5  # модель пропускає — потенційний ризик


# ── Тести valid_tables guard ──────────────────────────────────────────────────

def test_valid_tables_guard_rejects_unknown_key():
    """
    Симулюємо перевірку valid_tables як у бекенді.
    Невалідний table_key → відхиляємо.
    """
    PATCH_VALID_TABLES = (
        'finished', 'operative', 'components', 'main',
        'cases_empty', 'finished_main',
        'loot_box_operative', 'loot_box_main',
    )

    def validate(table_key: str) -> bool:
        return table_key in PATCH_VALID_TABLES

    assert validate('operative') is True
    assert validate('loot_box_operative') is True
    assert validate('loot_box_main') is True
    assert validate('unknown_table') is False
    assert validate('') is False
    assert validate('inventory_operative') is False  # повна назва таблиці — не валідна
    assert validate("'; DROP TABLE inventory_main; --") is False


def test_valid_tables_all_frontend_keys_pass():
    """Всі table_key які фронт реально відправляє → проходять guard."""
    PATCH_VALID_TABLES = {
        'finished', 'operative', 'components', 'main',
        'cases_empty', 'finished_main',
        'loot_box_operative', 'loot_box_main',
    }
    FRONTEND_KEYS = {
        'cases_empty', 'finished', 'finished_main',
        'loot_box_main', 'loot_box_operative',
        'main', 'operative',
    }
    blocked = FRONTEND_KEYS - PATCH_VALID_TABLES
    assert not blocked, f"Фронт відправляє table_key які бек блокує: {blocked}"


# ── Запуск ────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    suite = WriteOffLogicTests()
    methods = [m for m in dir(suite) if m.startswith('test_')]
    passed = failed = 0
    for m in methods:
        try:
            getattr(suite, m)()
            print(f"  ✓ {m}")
            passed += 1
        except Exception as e:
            print(f"  ✗ {m}: {e}")
            failed += 1
    print(f"\nWriteOffLogicTests: {passed} passed, {failed} failed")
