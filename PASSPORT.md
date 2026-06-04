# 📋 ПАСПОРТ РЕПОЗИТОРІЮ - grill-master-hub
**Дата створення:** 26.05.2026
**Останнє оновлення:** 04.06.2026
**Статус:** 🟢 Активна розробка
**Мова:** TypeScript / Python
**Приватність:** Private
**Автор:** Vova Vatsko (vatsko.vova@gmail.com)

---

## 🎯 Опис проекту
**grill-master-hub** — комплексна система управління виробництвом для BBQ/гриль-фабрики. PWA додаток для керування складом, завданнями, циклами виробництва та API для роботи з даними.
**Посилання на проект:** https://grill-master-hub.vercel.app

---

## 🏗️ Архітектура проекту
```
grill-master-hub/
├── bbq-api/                    # Backend API (Python + FastAPI)
│   ├── main.py                 # Основна логіка
│   ├── .env.example
│   └── requirements.txt
└── bbq-factory-os/             # Frontend (React + TypeScript)
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── pages/
    │   │   ├── Login.tsx       # Пін-код авторизація + реєстрація
    │   │   ├── Dashboard.tsx
    │   │   ├── Warehouse.tsx
    │   │   ├── Tasks.tsx
    │   │   ├── Tasker.tsx
    │   │   └── Salary.tsx
    │   ├── components/
    │   │   ├── Layout.tsx
    │   │   ├── BottomNav.tsx
    │   │   └── UI.tsx
    │   ├── context/
    │   │   └── AuthContext.tsx  # localStorage сесія
    │   └── lib/
    │       └── api.ts           # Всі HTTP запити
    ├── tailwind.config.js
    ├── vite.config.ts
    └── package.json
```

---

## 🔧 Технологічний стек

### Frontend
- React 18 + TypeScript + Vite 5 + Tailwind CSS 3
- react-router-dom v6, lucide-react

### Backend
- Python 3.11, FastAPI, asyncpg, python-dotenv
- PostgreSQL (asyncpg connection pool 2-10)

### Design
- Палітра: чорне дерево #080808 + золото #c9963a + сталь #8a9ba8
- Шрифти: Cormorant Garamond (заголовки), JetBrains Mono (mono), Rajdhani (основний)
- Мова інтерфейсу: українська

---

## 🌐 Конфігурація серверних портів та доменів
*(Nginx Proxy Manager на Google Cloud VPS — всі контейнери в мережі main-network)*

| Домен (Source) | Призначення | Destination (внутрішнє DNS) |
|---|---|---|
| bbq.wowusik.duckdns.org | Бойовий фронтенд (Production) | http://bbq-frontend:80 |
| test.wowusik.duckdns.org | Тестовий фронтенд | http://bbq-frontend-test:80 |
| api.wowusik.duckdns.org | Бойовий API (FastAPI) | http://bbq-api:8000 |
| api-test.wowusik.duckdns.org | Тестовий API (FastAPI) | http://api-test:8000 ⚠️ Block Common Exploits = OFF |
| n8n.wowusik.duckdns.org | n8n автоматизація | http://n8n:5678 |
| omi.wowusik.duckdns.org | Omi інтеграція | http://127.0.0.1:8082 |

> ⚠️ **ВАЖЛИВО для агентів:** НЕ використовувати IP 172.17.0.1 в налаштуваннях.
> Всі контейнери спілкуються через внутрішні імена Docker в мережі main-network.

---

## 🐳 Docker інфраструктура

### Мережа: main-network
├── nginx-proxy-manager
├── bbq-api
├── bbq-api-test
├── bbq-frontend
├── bbq-frontend-test
└── n8n

### Команди оновлення
```bash
# Оновити ТЕСТОВИЙ фронтенд:
cd /home/wowusik/grill_bot_new/repos/grill-master-hub/bbq-factory-os && npm run build
docker stop bbq-frontend-test && docker rm bbq-frontend-test
docker run -d --name bbq-frontend-test --restart unless-stopped \
  --network main-network -p 3005:80 \
  -v /home/wowusik/grill_bot_new/repos/grill-master-hub/bbq-factory-os/dist:/usr/share/nginx/html:ro \
  nginx:alpine

# Оновити ТЕСТОВИЙ API:
docker stop bbq-api-test && docker rm bbq-api-test
docker run -d --name bbq-api-test --restart unless-stopped \
  --network main-network -p 8001:8000 \
  -v /home/wowusik/grill_bot_new/repos/grill-master-hub/bbq-api/main.py:/app/main.py:ro \
  -v /home/wowusik/grill_bot_new/fastapigrill/bbq-api/.env:/app/.env:ro \
  python:3.11-slim \
  bash -c "pip install fastapi uvicorn asyncpg python-dotenv -q && cd /app && uvicorn main:app --host 0.0.0.0 --port 8000"
```

---

## 💾 База даних (PostgreSQL)

### Схема: bot_workshop
| Таблиця | Призначення |
|---|---|
| inventory_main | Основний склад |
| inventory_finished | Готова продукція |
| inventory_operative | Оперативний склад |
| master_tasks | Завдання майстрів |
| master_logs | Виконана робота |

---

## 📝 Журнал змін (Change Log)

### Сесія 4: Інтеграція сповіщень та безпека складу (04.06.2026)
* Запобіжник мінусів (Бекенд): Реалізовано жорстку перевірку залишків сировини в POST /api/master/logs. Транзакція блокується з помилкою 400, якщо компонентів немає на складі.
* Реверс при видаленні завдань: В ендпоінт DELETE /api/master/tasks/{id} інтегровано функцію повернення деталей на склад за рецептом моделі.
* Виправлення маршрутизації Docker ↔ n8n: Усунено проблему зв'язку всередині контейнерів. Змінну N8N_COMPONENTS_WEBHOOK_URL переведено на внутрішній IP докер-мережі (172.17.0.1).

---

## 📋 План подальшої розробки (Backlog / TODO)

### 🚀 Наступна задача: Перенос алярмів на створення/зміну ПЛАНУ (На випередження)
1. **Очищення POST /api/master/logs:** 
    * Прибрати (закоментувати) тимчасовий жорсткий запобіжник HTTPException(400), щоб майстри могли фіксувати роботу, навіть якщо склад іде в мінус. 
    * Вимкнути надсилання вебхуків з цього ендпоінту.
2. **Алярми при створенні плану (POST /api/master/tasks):**
    * При додаванні нового завдання рахувати прогнозний залишок: поточний_залишок - (рецепт * план).
    * Якщо значення < min_limit, запускати фоновий процес (BackgroundTasks) та крити на вебхук n8n дані: supplier, component_name, quantity (актуальний залишок). План при цьому створювати дозволяється.
3. **Логіка реверсу/дельти при редагуванні плану (PUT /api/master/tasks/{id}):**
    * Рахувати різницю: diff = нова_кількість_плану - стара_кількість_плану.
    * Якщо diff > 0 (план збільшився), перевіряти дефіцит під цю дозаявку: поточний_залишок - (рецепт * diff). Якщо впали нижче ліміту — тригерити n8n.
    * Якщо diff <= 0 (план зменшився або видалений), нічого не надсилати, просто оновлювати базу.

---

## 📈 Історія комітів (Commit History)
| Дата | Повідомлення |
|---|---|
| 04.06.2026 | "Fix: Delay MasterCabinet API calls until AuthContext is loaded" |
| 04.06.2026 | "Інтеграція сповіщень та безпека складу: запобіжник мінусів, реверс при видаленні завдань" |
| 26.05.2026 | "Connect all endpoints to real API, remove all demo data" |
| 26.05.2026 | "Add bbq-factory-os frontend" |
| 26.05.2026 | "Clear repository" |

---

## 🚀 Пріоритети розвитку
- [ ] Виправити автологін (localStorage)
- [ ] Salary.tsx — деталізація
- [ ] Баланс — об'єднана таблиця
- [ ] Введення виконаної роботи за день
- [ ] JWT авторизація замість піну

---
*Оновлено: 04.06.2026*
