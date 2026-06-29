### Активні завдання (Backlog)

- [x]  JWT авторизація
- [x]  Кабінет водія — чистка та архів
- [x]  Інтеграція скрипту списання в апку (Fix #13)
- [x]  Перенесення поповнення складу (Main→Operative) з Telegram-бота в додаток (Сесія 11)
- [x]  Фасування по партіях — версія 1 (коригування водієм) (Сесія 11-12)
- [x]  Система алярмів і поповнення cases_components з конвертацією (Сесія 13)
- [x]  Переробка логіки write-off: inventory_finished як пріоритет (Fix #14, 25.06.2026)
- [x]  Таскер — другий дропдаун для фурнітури з конвертацією + тоггл складу (25.06.2026)
- [x]  AdminWarehouses — видалено кнопку олівця з кейс-компонентів (25.06.2026)
- [x]  api.ts — видалено демо-режим `console.log('demo mode')` (25.06.2026)
- [x]  AdminWarehouses — sticky header в акордеонах Склади і Грилі (25.06.2026)
- [x] Колонка "Різниця" у складах — замінена повноцінною інвентаризацією
- [x]  AdminWarehouses — підсвітка min_limit червона активна; жовта потребує max_limit з API (25.06.2026)
- [x] AdminSystem — вкладка Система: логи списань з фільтрами, акордеони по сесіях, українські назви операцій (26.06.2026)
- [x] Інвентаризація складів: `InventoryCheckModal.tsx`, `inventory_checks` БД, Δ-бейдж під назвою товару, `GET /api/admin/inventory/checks/latest`, `POST /api/admin/inventory/check` (26.06.2026)
- [x]  **G19 — виправити рецепт (преміальні шампури замість звичайних):**
- [ ]  Інвентаризація: кнопка "Прийняти фактичне значення" — оновлює qty в системі до actual_qty (наступна ітерація після `inventory_checks`)
- [ ] Табси в акордеонах складів: "Поточні значення" / "Інвентаризація" (опціонально)
- [ ] AdminSystem — підвкладки "Рецепти грилів" і "Рецепти кейсів" (заглушки, реалізація окремо)
sql
- [x] loot_box архітектура — нові таблиці `loot_box_operative` і `loot_box_main`; 
      53 позиції компонентів ящиків перенесено з inventory_operative/main; 
      write_off автовизначає таблицю; GET /api/stock +2 категорії; 
      PATCH inventory + POST inventory/check підтримують нові table_key; 
      AdminWarehouses: новий табс "Ящики"; AdminDashboard: акордеон "Ящики" в алярмах; 
      інвентаризація (ClipboardCheck) додана у всі табси для всіх колонок (29.06.2026)

```sql
    UPDATE bot_workshop.recipes SET item_id = 'преміальні шампури' WHERE set_id = 'G19' AND item_id = 'Шампур';
```

- [ ]  **max_limit з API для жовтої підсвітки** — додати `max_limit` в SELECT запит `/api/stock` щоб жовта підсвітка в акордеоні Склади запрацювала.
- [ ]  **FIFO по партіях для алярмів поповнення майстерні:** **Проблема:** склад (`inventory_main`) зберігає лише сумарне `quantity` — партії фізично змішуються. Алярм поповнення не знає яке фасування показати майстру якщо було дві поставки з різним фасуванням. **Узгоджена архітектура:**
    
    1. Нова таблиця `bot_workshop.replenish_log` — журнал видач: `id, item_id, batch_delivery_id (FK→task_deliveries.id), qty_taken, taken_at`.
    2. `GET /api/master/replenish-alerts` — FIFO логіка: для дефіцитного `item_id` вибрати `task_deliveries WHERE destination='main' ORDER BY delivered_at ASC`, відняти вже видане з `replenish_log`, знайти першу невичерпану партію → показати її фасування.
    3. `POST /api/master/replenish/{id}/confirm` — писати рядок в `replenish_log` при підтвердженні.
    
    **Статус:** архітектура узгоджена, реалізація не починалась.
- [ ]  **Правила фасування для фурнітури (`cases_components`):**
    - Наразі `packaging_rules` не має записів для позицій фурнітури.
    - Матей має заповнити по мірі надходження поставок.
    - Поки таски фурнітури водію не показують фасування — тільки назву і кількість в природних одиницях.
- [ ]  **PWA — встановлення як нативний додаток + пуш-нотифікації:** **Частина 1 — PWA manifest (просто):**
    
    - `vite-plugin-pwa` — автоматичний Service Worker + кешування
    - `manifest.json` — назва "Grills Factory", іконки, `display: standalone`, кольори `#0a0a0a` / `#c9963a`
    - Після цього браузер запропонує "Додати на головний екран"
    
    **Частина 2 — Пуш-нотифікації (середня складність):**
    
    - VAPID ключі (генеруються один раз)
    - Бекенд: нова таблиця `push_subscriptions` (device_id, subscription_json, user_id)
    - `pywebpush` в `main.py` — надсилання пушів
    - Фронтенд: запит дозволу + підписка через `PushManager`
    - Сценарії пушів: алярми складу, алярми фурнітури, нові таски для водія
    - ⚠️ iOS — тільки Safari 16.4+ і тільки якщо додаток на головному екрані
    
    **Статус:** не починалось, архітектура зрозуміла.
- [ ]  **Адмін — керування довідниками (CRUD для таблиць):** **Частина 1 — Додавання нових позицій в склади:**
    
    - `inventory_main` — кнопка "+" → форма (назва, кількість, одиниця, min_limit)
    - `inventory_operative` — кнопка "+" → форма (назва, кількість, min_limit, max_limit)
    - `cases_components` — кнопка "+" → форма (назва, кількість, unit_type, conversion_factor, is_internal, min_threshold)
    - Відповідні POST ендпоінти в `main.py`
    
    **Частина 2 — Таблиці рецептів в адмінці (нова вкладка або секція в Склади):** Рецепти для наборів (`bot_workshop.recipes`):
    
    - Відображати як список: артикул набору → список інгредієнтів з кількістю
    - Можна додати інгредієнт, змінити кількість, видалити рядок
    - Можна додати новий набір
    
    Рецепти для кейсів (`bot_workshop.recipes_cases`):
    
    - Відображати як список: артикул кейсу → список компонентів з кількістю
    - Ті ж операції — додати/змінити/видалити
    
    **Нові ендпоінти бекенду:**
    
    - `GET/POST/DELETE /api/admin/recipes`
    - `GET/POST/DELETE /api/admin/recipes-cases`
    - `POST /api/admin/inventory-main`
    - `POST /api/admin/inventory-operative`
    - `POST /api/admin/components`
    
    **Статус:** не починалось, архітектура зрозуміла.
- [ ]  **Підготовка до міграції на новий сервер** — дедлайн кінець тижня.
- [ ] **Вкладка "Опт" в кабінеті адміна (замість "Відправки"):**
  Архітектура узгоджена повністю.
  
  БД нові таблиці:
  - `wholesale_buffer` (id, article, planned_qty, status, created_at, cancelled_at, note)
  - `wholesale_reservations` (id, buffer_id FK, source operative/main/components, item_id, reserved_qty)
  
  Флоу бронювання: Матей вводить планову кількість артикулу → система рахує
  по recipes → бронює компоненти з трьох таблиць (operative пріоритет → main → components),
  залишки можуть іти в мінус — Матей сам бачить і замовляє потрібне.
  
  Флоу списання: н8н відстежує появу ТТН в оптовому замовленні CRM → 
  POST /api/wholesale/confirm/{buffer_id} → бекенд списує реальні залишки по бронях.
  
  Н8н частина: окреме повідомлення для опту в той самий TG топік, message_id
  зберігається окремо в tg_message_state (ключ chat_id+'_wholesale'), редагується
  при змінах як звичайне. Закріплення вручну офісом. Якщо оптових нема — нічого не шлється.
  
  Статус: архітектура фіналізована, реалізація не починалась.

- [ ] **Видалити вкладку "Відправки" з MasterCabinet.tsx** — замінюється вкладкою Опт.

---

### Важливі архітектурні нюанси (для агентів)
- **loot_box таблиці:** компоненти подарункових ящиків зберігаються окремо від inventory_operative/main. 
  write_off автоматично визначає таблицю по наявності item_id в loot_box_operative. 
  Тригер алярмів на loot_box_operative має бути аналогічний trg_operative_replenish.

- **`is_written_off` в `daily_shipments`:** скрипт списання обробляє ВСІ записи де `false` — НЕ фільтрує по даті. В штатному режимі (тільки cron о 22:00) це безпечно. При ручному тестуванні — ризик подвійного списання.
- **Конвертація одиниць `cases_components`:** `unit_type` + `conversion_factor` — для відображення в природних одиницях і розрахунку qty при поповненні. `qty_to_add = input_value * conversion_factor`.
- **Два типи тасок в `incoming_tasks`:** звичайні (inventory_main/operative) і фурнітурні (`component_id IS NOT NULL`). Бекенд `/deliver` розгалужується по наявності `component_id`.
- **`is_internal` в `cases_components`:** true → Матей робить сам (одразу поповнює), false → їде з пошти (створює таску водію).
- **Логіка write-off (оновлено 25.06):** пріоритет `inventory_finished` → залишок в `inventory_cases` + `recipes` → `inventory_operative` (кейс) або `recipes` → `inventory_operative` (не-кейс). `recipes_cases`/`cases_components` в write-off НЕ використовуються — вони оновлюються при логуванні майстра.
- **AdminWarehouses sticky header:** `overflow-hidden` видалено з акордеонів Склади і Грилі — необхідно для `position: sticky`. Вміст більше не обрізається по заокругленим кутах.
- **Жовта підсвітка складів:** неактивна поки `max_limit` не додано в `/api/stock`.

---

### Історія вирішених інцидентів
- **Сесія 16: loot_box архітектура (29.06.2026):**
    - Нові таблиці: `bot_workshop.loot_box_operative` (структура як inventory_operative), 
      `bot_workshop.loot_box_main` (структура як inventory_main).
    - Перенесено 53 позиції компонентів ящиків (Турист, BBQ, Віскі, Винний, Лазня, 
      Автолюбитель макс/стандарт, Полуничка, Пивний). Додано 4 нові з qty=0: 
      Костер х4, Декантер, Камені, Щипці.
    - `run_write_off`: перед UPDATE перевіряє `loot_box_operative` — якщо компонент там, 
      списує звідти, інакше — `inventory_operative`. `history_logs.source` динамічний.
    - `GET /api/stock`: +2 UNION ALL (loot_box_main, loot_box_operative).
    - `GET /api/notifications`: алярми з нових таблиць.
    - `PATCH /api/admin/inventory` і `POST /api/admin/inventory/check`: нові table_key.
    - `AdminWarehouses.tsx`: табс "Ящики", LootBoxRow інтерфейс, saveEditLootBox.
    - `AdminDashboard.tsx`: 4-й акордеон "Ящики" в алярмах.
    - Інвентаризація (ClipboardCheck): додана у всі табси для всіх колонок.
- **Fix #14 (Переробка логіки вечірнього списання, 25.06.2026):**
    - Нова пріоритетність: `inventory_finished` → `inventory_cases` + `recipes` → `inventory_operative`.
    - Видалено блок `recipes_cases`/`cases_components` з `run_write_off`.
    - Протестовано dry_run: всі три сценарії працюють коректно.
    - Файл: `bbq-api/main.py`, функція `run_write_off`.
- **Fix #13 (Інтеграція скрипту списання + очистка БД рецептів, 23.06.2026):**
    - `write_off_service.py` не був в crontab — місяць не виконувався.
    - Очищено БД: дублі в `recipes`, регістр `g18→G18`, неправильні рядки ПИЛЬНИК/чохол, `Тримач телефону→Тримач тел`.
    - Нові компоненти `cases_components`: Газліфт ЗД/ПД, Обмежувач, Ніжки, Перегородки GT/G12T/G12.
    - МВ рецепти: `recipes_cases` для MB1/MB2/MBA1/MB3, `recipes` для MBA1.
    - GT серія: `recipes_cases` і `recipes` скопійовані з відповідних G артикулів.
    - Чохли: `inventory_operative.чохол` → `Чохол М` (40шт) і `Чохол В` (40шт). n8n виправлено.
    - `POST /api/admin/write-off?dry_run=false/true` — повна логіка списання.
    - Cron: `0 22 * * 1-5 curl -s -X POST "http://localhost:8001/api/admin/write-off?dry_run=false"`.
- **Fix #12 (Серія дрібних UI/UX правок після Fix #11, 20.06.2026):**
    - Акордеони за замовчуванням закриті, уніфікація стилю балансу, природне числове сортування.
    - AdminTasker: прибрані зайві кнопки, фільтр архіву, редагування завдань (`PATCH /api/admin/incoming-tasks/{id}`).
    - Кабінет водія: фікс зависання кнопки "Зберегти" (відсутній `finally` блок).
- **Fix #11 (Таскер — повний цикл доставки, 19.06.2026):**
    - Реструктуризація БД: `public.driver_tasks*` → deprecated, `bot_workshop.task_deliveries` — нова таблиця факту доставки.
    - Нові ендпоінти: `GET /api/driver/tasks`, `POST /api/driver/tasks/{id}/deliver`, `GET /api/items/main`, `GET /api/items/operative`.
    - `Tasker.tsx` переписаний з нуля.
    - Урок: при 502 дивитись `docker logs`, не браузерну консоль.
- **Fix #10 (Прихована трансформація категорій, 12.06.2026):**
    - `api.ts` тихо трансформує `finished→ready`. Урок: завжди трасувати повний шлях SQL→api.ts→компонент.
- **Fix #9 (Shipments Aggregation & Monolith Restoration):**
    - Рефакторинг вкладки Відправки, акордеони по днях, кнопка RefreshCw.
- **Fix #8 (UI Kit Restoration & TS Types):**
    - Відновлено UI.tsx, `StatCard.icon` → `React.ReactNode`.
- **Fix #7 (Branding & UX Alignment):**
    - Ребрендинг BBQ OS → Grills factory, фон логіну, де-емодзифікація.
- **Fix #6:** Рефакторинг BottomNav та MasterCabinet.
- **Fix #5:** Автономність AuthContext, чорний екран при вході.
- **Fix #4:** Прихований catch, помилка реєстрації 422.