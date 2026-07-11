-- Не виконувати автоматично — Вова запускає вручну.
--
-- accepted_by/accepted_at/resolution на defects: хто і коли прийняв
-- дефект у роботу (CRM-повернення) або завів вручну (manual), та який
-- був фінальний результат (fixed/written_off). accepted_by також
-- використовується для перевірки власності — завершити (fix/writeoff)
-- може лише той майстер, що прийняв.

ALTER TABLE bot_workshop.defects
  ADD COLUMN IF NOT EXISTS accepted_by varchar(100),
  ADD COLUMN IF NOT EXISTS accepted_at timestamp,
  ADD COLUMN IF NOT EXISTS resolution varchar(20);
