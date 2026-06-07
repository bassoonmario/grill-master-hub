# 📋 ПАСПОРТ РЕПОЗИТОРІЮ - grill-master-hub [TEST-BRANCH]

**Гілка:** `test-branch`  
**Дата створення:** 26.05.2026  
**Останнє оновлення:** 04.06.2026  
**Статус:** 🟢 Актуальний (оновлено)  
**Мова:** TypeScript / Python  
**Автор:** Vova Vatsko (vatsko.vova@gmail.com)  

---

## ℹ️ Інформація про гілку

| Параметр | Значення |
|----------|----------|
| Останній комміт | `821946882820d8178ab53bc2df087f0a332fcd4a` |
| Повідомлення комміту | "Fix: Delay MasterCabinet API calls until AuthContext is loaded" |
| Базова гілка | `main` |
| Захищена | ❌ Ні |

---

## 🎯 Опис гілки TEST-BRANCH

**test-branch** — експериментальна гілка для тестування нових функцій та інтеграцій (Master Cabinet, Master workflow, оновлення UI/UX, Docker і CI-ready конфігурації).

Наразі test-branch містить додаткові зміни, які відрізняють її від main (див. розділ "Відмінності").

---

## 📊 Поточний стан (резюме аудиту)

- Останній комміт на гілці: 821946882820d8 (2026-06-04) — автор Vova Vatsko
- Branch protection: не встановлено
- CI (GitHub Actions): немає recent workflow runs на гілці (відсутні або не налаштовані)
- Відмінності від main: наявні зміни (додаються нові файли та модифікації)
- Тести/покриття: в репозиторії немає явної інтеграції тестового runner-а або звітів про покриття

---

## 🔎 Ключові зміни, виявлені в test-branch

(Зафіксовано відповідно до diff між main та test-branch)

1) Backend (bbq-api)
- Додано значну кількість ендпойнтів для авторизації (/api/auth/register, /api/auth/login, /api/auth/users).
- Розширено API: /api/master/* (dashboard, tasks CRUD, logs, stats), поліпшено /api/dashboard, /api/tasks, /api/tasker.
- Додано обробку валідації помилок (RequestValidationError handler) та фонова відправка webhooks (httpx) для n8n при низьких залишках.
- Додано Dockerfile, requirements.txt оновлено (httpx).
- Додано .env з реальними (!) значеннями: DB_HOST=34.158.230.196, DB_PASS=secret123, FRONTEND_URL=*
  - Ризик: конфіг з паролями у репозиторії — потрібно видалити та перемістити в secrets.

2) Frontend (bbq-factory-os)
- Багато нових сторінок і компонентів: MasterCabinet, Balance, оновлені Login, Tasks, Salary, BottomNav, Layout, AuthContext.
- Змінено VITE_API_URL на https://api-test.wowusik.duckdns.org у .env (тестовий API).
- Додано Dockerfile і nginx.conf для прод/стейдж збірки.
- Оновлено UI (шрифти, кольори, tailwind config).

3) Інфраструктура
- Додано docker-compose.yml для локального тестування двох сервісів (api і frontend).

4) Тестові/інструментальні зміни
- Додано скомпільовані /pycache/ файли та .env у репо — потрібно видалити з комітів та додати до .gitignore.

---

## ⚠️ Проблеми та рекомендації (критичні та високі пріоритети)

1) Чутливі дані у репозиторії
- Файл: bbq-api/.env містить DB credentials (DB_PASS=secret123) і FRONTEND_URL=*.
- Дія: негайно видалити .env з комітів, додати до .gitignore та перенести секрети у GitHub Secrets / CI secrets.

2) Закомічені бінарні/системні файли
- Додано: bbq-api/__pycache__/main.cpython-311.pyc — має бути видалено.
- Дія: git rm --cached цих файлів та додати __pycache__/ до .gitignore.

3) Вразливі CORS та відкриті URL
- FRONTEND_URL = * у .env та CORSMiddleware allow_origins=["*"] у коді — ризик для production.
- Дія: обмежити дозволені домени перед продом.

4) Відсутність захисту гілки і CI
- Немає workflow runs для test-branch; не виявлено GitHub Actions pipelines.
- Дія: налаштувати мінімальний CI (lint, typecheck, unit tests) та захист гілки перед merge.

5) Паролі у відкритому вигляді
- DB_PASS=secret123 — змінити пароль бази, використати секрети.

6) Можливі регресії
- Значні зміни в API та DB-запитах — потребують інтеграційного тестування з пошуковими даними та staging середовищем.

---

## 🧾 Відмінності test-branch від main (резюме diff)

- Нові файли: docker-compose.yml, bbq-api/Dockerfile, bbq-factory-os/Dockerfile, bbq-factory-os/nginx.conf, багато src компонентів (MasterCabinet, Balance, сторінки), .env зміни.
- Модифіковані файли: bbq-api/main.py (великі доповнення), bbq-factory-os/src/* (багато змін), TEST_BRANCH_PASSPORT.md оновлено.
- Видалені/не вказані: — (немає масових видалень).

---

## 🔧 Рекомендовані дії (кроки для безпечного об'єднання в main)

1) Безпека та секрети
- Видалити bbq-api/.env з репозиторію: git rm --cached bbq-api/.env; додати в .gitignore.
- Встановити DB credentials у GitHub Actions secrets або у середовищі деплойменту.
- Перезмінити пароль БД, якщо сервер публічний і не мав захисту.

2) Очищення репо
- Видалити __pycache__ та інші артефакти: git rm --cached -r bbq-api/__pycache__.
- Додати стандартний .gitignore (Python, Node, env, pycache).

3) CI / Quality gates
- Додати GitHub Actions workflow: linters (eslint, flake8/mypy), build (npm build), unit/integration tests, security scan (dependabot, trivy), and deployment on staging.
- Налаштувати branch protection для main + require PR review.

4) Тестування інтеграцій
- Розгорнути docker-compose локально або на staging (docker-compose.yml) і виконати інтеграційні тести оскільки API проводить маніпуляції зі складом і може списувати компоненти.

5) Рефакторинг і hardening
- Переглянути місця, де pin_code зберігається у відкритому вигляді у БД (потрібне хешування, bcrypt).
- Додати обмеження та перевірки у запитах (ownership checks, input validation — наразі є базова валідація, але варто розширити).

---

## ✅ Додано у TEST_BRANCH_PASSPORT.md (оновлення виконано)

- Оновлено останній комміт, дату оновлення та статус документа.
- Додано детальний розбір diff між main та test-branch (включаючи список доданих файлів і основні зміни).
- Додано список критичних проблем та рекомендацій (секрети, pycache, CORS, CI).

---

## 📌 Наступні кроки (за бажанням)

- Хочете, щоб я:
  - негайно видалив bbq-api/.env та __pycache__ з комітів у test-branch і закомітив зміни? (Підтвердіть: git push напряму в test-branch)
  - створив PR з очищенням секретів та .gitignore?
  - налаштував базовий GitHub Actions workflow (CI) у test-branch і запустив прогін?

---

*Аудит виконано автоматично за запитом користувача. Якщо потрібно деталізувати будь-який пункт — скажіть який саме.*
