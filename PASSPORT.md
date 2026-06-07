# 📋 ПАСПОРТ РЕПОЗИТОРІЮ - grill-master-hub
**Дата створення:** 26.05.2026
**Останнє оновлення:** 05.06.2026
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
    │   │   ├── Salary.tsx
    │   │   └── MasterCabinet.tsx # Нова сторінка
    │   ├── components/
    │   │   ├── Layout.tsx
    │   │   ├── BottomNav.tsx
    │   │   └── UI.tsx
    │   ├── context/
    │   │   └── AuthContext.tsx  # Логіка входу + API_BASE
    │   └── lib/
    │       └── api.ts           # HTTP запити
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
| api-test.wowusik.duckdns.org | Тестовий API (FastAPI) | http://bbq-api-test:8000 |
| n8n.wowusik.duckdns.org | n8n автоматизація | http://n8n:5678 |
| omi.wowusik.duckdns.org | Omi інтеграція | http://127.0.0.1:8082 |

> ⚠️ **ВАЖЛИВО:** Всі контейнери спілкуються через внутрішні імена Docker в мережі `main-network`.

---

## 🐳 Docker інфраструктура

### Мережа: main-network

### Команди оновлення (Чистий білд)

```bash
# Оновити ТЕСТОВИЙ API:
docker stop bbq-api-test && docker rm bbq-api-test
docker build -t bbq-api-test -f bbq-api/Dockerfile bbq-api/
docker run -d --name bbq-api-test --restart unless-stopped \
  --network main-network -p 8001:8000 --env-file bbq-api/.env bbq-api-test

# Оновити ТЕСТОВИЙ фронтенд (Vite вшиває змінні при білді):
cd /home/wowusik/grill_bot_new/repos/grill-master-hub/
# Тимчасово записуємо VITE_API_URL в .env, білдимо, потім видаляємо
echo "VITE_API_URL=http://bbq-api-test:8000" > bbq-factory-os/.env
docker build -t bbq-frontend-test -f bbq-factory-os/Dockerfile bbq-factory-os/
rm bbq-factory-os/.env
docker stop bbq-frontend-test && docker rm bbq-frontend-test
docker run -d --name bbq-frontend-test --restart unless-stopped \
  --network main-network -p 3005:80 bbq-frontend-test
```

---

## 💾 База даних (PostgreSQL)
*Схема: bot_workshop*
| Таблиця | Призначення |
|---|---|
| inventory_main | Основний склад |
| inventory_finished | Готова продукція |
| daily_shipments | Відправки |
| defects | Брак |
| master_tasks | Завдання майстрів |
| master_logs | Виконана робота |

---

## 📝 Журнал змін (Change Log)

### Сесія 5: Інтеграція Відправок та Браку (05.06.2026)
- Додано GET /api/master/shipments та /api/master/defects.
- Реалізовано динамічну маршрутизацію для Frontend (API_BASE).
- Оновлено Кабінет Майстра (вкладки відправок та браку).
- Виправлено "мовчазні" помилки авторизації (Fix #4, #5).
- Оновлено Docker інструкції: перехід на повний білд образу.

### Сесія 4: (04.06.2026)
- Реалізовано логування, безпеку складу та алярми через n8n.

---

## 📋 План подальшої розробки
- [ ] Виправити автологін (localStorage)
- [ ] Salary.tsx — деталізація
- [ ] Баланс — об'єднана таблиця
- [ ] JWT авторизація
