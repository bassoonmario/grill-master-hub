-- Не виконувати автоматично — Вова запускає вручну.
--
-- 1) max_qty на office_stock: верхня межа для поповнення (не поріг дефіциту).
-- 2) min_limit/max_limit на inventory_finished та inventory_finished_main:
--    сигнал дефіциту/перезапасу в кабінеті офісу (аналогічно вже наявним
--    min_limit/max_limit у admin-складах).
-- 3) article на pickup_reservations: прив'язка резерву до конкретної позиції
--    самовивіз-замовлення — дзеркалить wholesale_reservations.article,
--    потрібна для per-item override джерела (PATCH /api/pickup/{id}/source).

ALTER TABLE bot_workshop.office_stock ADD COLUMN IF NOT EXISTS max_qty integer DEFAULT 0;

ALTER TABLE bot_workshop.inventory_finished ADD COLUMN IF NOT EXISTS min_limit integer DEFAULT 0;
ALTER TABLE bot_workshop.inventory_finished ADD COLUMN IF NOT EXISTS max_limit integer DEFAULT 0;

ALTER TABLE bot_workshop.inventory_finished_main ADD COLUMN IF NOT EXISTS min_limit integer DEFAULT 0;
ALTER TABLE bot_workshop.inventory_finished_main ADD COLUMN IF NOT EXISTS max_limit integer DEFAULT 0;

ALTER TABLE bot_workshop.pickup_reservations ADD COLUMN IF NOT EXISTS article text;
