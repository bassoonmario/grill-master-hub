"""
Unit tests для логіки нормалізації артикулів у run_write_off.
Чиста логіка — ніякого DB, ніякого IO.
"""

# Копія логіки з main.py — щоб тестувати ізольовано
SKIP = {'ГРАВІЮВАННЯ ШАМПУРІВ', 'ЧОХОЛ'}

DIRECT_OPERATIVE = {
    'ЧОХОЛ М': 'Чохол М',
    'ЧОХОЛ В': 'Чохол В',
    'ПИЛЬНИК': 'ПИЛЬНИК',
    'ДОЩЕЧКА': 'дощечка',
}


def normalize_article(raw_article: str) -> str:
    """Крок 1: кирилиця С → латиниця S (тільки для коротких артикулів)."""
    article = raw_article
    if len(raw_article) <= 5:
        article = raw_article.replace('С', 'S')
    return article


def compute_base_article(article: str) -> str:
    """Крок 2: видаляємо суфікси H і T (крім T1/T1S)."""
    if article.startswith('T1'):
        return article
    return article.replace('H', '').replace('T', '')


def classify_article(raw_article: str):
    """Повна класифікація артикулу як в run_write_off."""
    article = normalize_article(raw_article.strip().upper())
    if article in SKIP:
        return ('skip', None)
    if article in DIRECT_OPERATIVE:
        return ('direct_operative', DIRECT_OPERATIVE[article])
    base = compute_base_article(article)
    return ('recipe', base)


# ── Тести нормалізації ────────────────────────────────────────────────────────

def test_cyrillic_s_replaced_in_short_article():
    assert normalize_article('T1С') == 'T1S'
    assert normalize_article('G12С') == 'G12S'


def test_cyrillic_s_not_replaced_in_long_article():
    # Довгі артикули (>5 символів) не замінюються
    assert normalize_article('ЧОХОЛ М') == 'ЧОХОЛ М'
    assert normalize_article('ДОЩЕЧКА') == 'ДОЩЕЧКА'


def test_latin_s_unchanged():
    assert normalize_article('G17S') == 'G17S'
    assert normalize_article('T1S') == 'T1S'


# ── Тести base_article ────────────────────────────────────────────────────────

def test_h_suffix_removed():
    assert compute_base_article('G12H') == 'G12'
    assert compute_base_article('G17SH') == 'G17S'


def test_t_suffix_removed():
    assert compute_base_article('G12T') == 'G12'


def test_both_suffixes_removed():
    assert compute_base_article('G12TH') == 'G12'
    assert compute_base_article('G12HT') == 'G12'


def test_t1_prefix_protected():
    """T1 і T1S не змінюються — захищений префікс."""
    assert compute_base_article('T1') == 'T1'
    assert compute_base_article('T1S') == 'T1S'
    assert compute_base_article('T1H') == 'T1H'  # T1* → не чіпаємо


def test_no_suffixes_unchanged():
    assert compute_base_article('G17S') == 'G17S'
    assert compute_base_article('G12') == 'G12'


# ── Тести класифікації ────────────────────────────────────────────────────────

def test_skip_articles():
    assert classify_article('ГРАВІЮВАННЯ ШАМПУРІВ') == ('skip', None)
    assert classify_article('ЧОХОЛ') == ('skip', None)
    assert classify_article('  чохол  ') == ('skip', None)  # trim + upper


def test_direct_operative_articles():
    kind, target = classify_article('ЧОХОЛ М')
    assert kind == 'direct_operative'
    assert target == 'Чохол М'

    kind, target = classify_article('ЧОХОЛ В')
    assert kind == 'direct_operative'
    assert target == 'Чохол В'

    kind, target = classify_article('ПИЛЬНИК')
    assert kind == 'direct_operative'
    assert target == 'ПИЛЬНИК'

    kind, target = classify_article('ДОЩЕЧКА')
    assert kind == 'direct_operative'
    assert target == 'дощечка'


def test_recipe_article_normalization():
    kind, base = classify_article('G12H')
    assert kind == 'recipe'
    assert base == 'G12'

    kind, base = classify_article('G17SH')
    assert kind == 'recipe'
    assert base == 'G17S'

    kind, base = classify_article('T1S')
    assert kind == 'recipe'
    assert base == 'T1S'  # T1* → незмінний


def test_cyrillic_c_in_article_before_skip_check():
    """Кирилична С замінюється ДО перевірки SKIP."""
    # 'T1С' (з кириличною С) → normalize → 'T1S' → не в SKIP → recipe
    kind, base = classify_article('T1С')
    assert kind == 'recipe'
    assert base == 'T1S'


def test_empty_article_goes_to_recipe():
    """Пустий рядок не крашить, йде в recipe."""
    kind, base = classify_article('')
    assert kind == 'recipe'
    assert base == ''


def test_case_insensitive_skip():
    """Артикул у lowercase теж розпізнається."""
    kind, _ = classify_article('гравіювання шампурів')
    assert kind == 'skip'


# ── Стрес: масова нормалізація ────────────────────────────────────────────────

def test_bulk_normalization_no_crash():
    """1000 різних рядків — жоден не крашить."""
    import string, random
    chars = string.ascii_uppercase + 'НТГС0123456789'
    for _ in range(1000):
        length = random.randint(1, 15)
        raw = ''.join(random.choices(chars, k=length))
        try:
            classify_article(raw)
        except Exception as e:
            raise AssertionError(f"classify_article крашнув на '{raw}': {e}")
