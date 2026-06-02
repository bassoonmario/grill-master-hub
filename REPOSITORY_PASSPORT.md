# 📋 ПАСПОРТ РЕПОЗИТОРІЮ - grill-master-hub

**Дата створення:** 26.05.2026  
**Останнє оновлення:** 26.05.2026  
**Статус:** 🟢 Активна розробка  
**Мова:** TypeScript / Python  
**Приватність:** Private  
**Автор:** Vova Vatsko (vatsko.vova@gmail.com)  

---

## 🎯 Описание проекту

**grill-master-hub** — це комплексна система управління виробництвом для BBQ/гриль-фабрики. Проект включає веб-додаток для керування складом, завданнями, циклами виробництва та API для роботи з даними.

**Посилання на проект:** https://grill-master-hub.vercel.app

---

## 📊 Статистика репозиторію

| Метрика | Значення |
|---------|----------|
| Розмір | 44 KB |
| Кількість комітів | 3 (початкова фаза) |
| Відкритих Issues | 0 |
| Pull Requests | 0 |
| Гілок | Основна гілка: `main` |
| Зірок | 0 |
| Форків | 0 |

---

## 🏗️ Архітектура проекту

```
grill-master-hub/
├── bbq-api/                    # Backend API (Python + FastAPI)
│   ├── main.py                 # Основна application логіка
│   ├── .env.example            # Приклад конфігурації
│   └── requirements.txt        # Python залежності (не завантажено)
│
└── bbq-factory-os/             # Frontend (React + TypeScript)
    ├── src/
    │   ├── main.tsx            # Entry point React app
    │   ├── App.tsx             # Main App component
    │   ├── pages/
    │   │   ├── Login.tsx       # Сторінка входу
    │   │   ├── Tasker.tsx      # Управління завданнями
    │   │   └── [інші сторінки]
    │   ├── components/
    │   │   ├── Layout.tsx      # Основний layout з навігацією
    │   │   ├── BottomNav.tsx   # Нижня навігація
    │   │   └── [інші компоненти]
    │   ├── context/
    │   │   └── AuthContext.tsx # Управління аутентифікацією
    │   ├── api.ts              # API cliente (HTTP запити)
    │   └── vite-env.d.ts       # Типи для Vite
    ├── tailwind.config.js      # Конфігурація Tailwind CSS
    ├── vite.config.ts          # Конфігурація Vite bundler
    ├── tsconfig.json           # TypeScript конфігурація
    ├── package.json            # npm залежності
    └── index.html              # HTML template

```

---

## 🔧 Технологічний стек

### Frontend (bbq-factory-os)
```
📦 Core Framework:
├─ React 18.3.1              # UI Framework
├─ React Router DOM 6.26.0    # Маршрутизація
└─ React DOM 18.3.1           # React рендерер

🎨 UI & Styling:
├─ Tailwind CSS 3.4.7         # Utility-first CSS framework
├─ PostCSS 8.4.40             # CSS processor
├─ Autoprefixer 10.4.19        # Автоматичне додавання префіксів
└─ Lucide React 0.383.0        # Icon library

⚙️ Build Tools:
├─ Vite 5.4.1                 # Modern bundler
├─ @vitejs/plugin-react       # React plugin для Vite
└─ TypeScript 5.5.3           # Type-safe JavaScript

🎭 Development:
├─ @types/react 18.3.3        # React type definitions
└─ @types/react-dom 18.3.0    # React DOM type definitions
```

### Backend (bbq-api)
```
⚙️ Runtime & Framework:
├─ Python 3.x                 # Programming language
├─ FastAPI                    # Modern, fast web framework
├─ asyncpg                    # Async PostgreSQL driver
└─ python-dotenv              # Environment variables management

🔌 Infrastructure:
├─ PostgreSQL                 # Database
└─ CORS Middleware            # Cross-origin resource sharing

```

---

## 💾 Структура даних

### Database Schema (PostgreSQL)

```sql
-- Модулі бази даних:
bot_workshop.inventory_main          -- Основний склад
bot_workshop.inventory_finished      -- Готовий товар
bot_workshop.inventory_operative     -- Операційний склад
```

**Таблиці включають:**
- `item_id` — Унікальний ID товару
- `item_name` — Назва товару
- `quantity` — Кількість
- `min_limit` — Мінімальний ліміт запасу
- `status` — Статус (ok, low, critical)

---

## ✨ Реалізовані функції

### ✅ Вже Розроблено:

#### 1. **Аутентифікація & Авторизація**
- [x] Сторінка входу з email/пароль
- [x] 3 ролі користувачів: Admin, Master, Driver/Комірник
- [x] Context-based управління станом аутентифікації
- [x] Session persistence

#### 2. **Управління Складом (Stock Management)**
- [x] API endpoint: `/api/stock`
- [x] Отримання інвентарю з 4 категорій:
  - Основний склад (main)
  - Готовий товар (finished)
  - Операційний склад (operative)
- [x] Автоматичне визначення статусу товару (ok/low/critical)
- [x] Мінімальні ліміти запасу

#### 3. **Управління Завданнями (Tasker)**
- [x] Сторінка `Tasker.tsx` для керування дорученнями
- [x] Система чекліста для кожного завдання
- [x] Статуси завдань: new, progress, done
- [x] API endpoints:
  - `taskerCards()` — отримання списку завдань
  - `confirmTasker(cardId)` — підтвердження завдання
- [x] Real-time UI оновлення

#### 4. **UI/UX Компоненти**
- [x] Responsive дизайн з Tailwind CSS
- [x] Темна тема з custom color palette:
  - `bg` — #0a0a0a (основний фон)
  - `surface` — #141414 (поверхня)
  - `orange` — #ff5c1a (основна akcent)
- [x] Custom шрифти (Bebas Neue, IBM Plex Sans/Mono)
- [x] Bottom Navigation
- [x] Top Bar з інформацією про користувача
- [x] Animations (fade-in, scale)

#### 5. **API & Backend**
- [x] FastAPI сервер на Python
- [x] CORS middleware налаштування
- [x] PostgreSQL connection pooling (asyncpg)
- [x] Health check endpoint: `/health`
- [x] Цикл-залежна логіка (1-15 день / 16-кінець місяця)
- [x] Real API connection (видалено всі demo data)

#### 6. **Deploy & Hosting**
- [x] Vercel deployment (фронтенд)
- [x] TypeScript strict mode увімкнено
- [x] Production build конфігурація

---

## 🚀 Плани розвитку (TODO)

### 🔴 Необхідно зробити:

#### Phase 1 - Core Features:
- [ ] **Аналітика & Звіти**
  - Dashboard з графіками продуктивності
  - Звіти по циклам виробництва
  - Export в PDF/Excel

- [ ] **Управління Циклами**
  - CRUD операції для циклів
  - Планування виробництва
  - Календарне подання

- [ ] **Уведомлення & Alerts**
  - Email/SMS уведомлення про критичні запаси
  - Push notifications
  - Alert історія

#### Phase 2 - Advanced Features:
- [ ] **Інтеграція з IoT**
  - Real-time сенсори з гриля
  - Температура моніторинг
  - Автоматичні алерти

- [ ] **Mobile App**
  - React Native / Flutter додаток
  - Офлайн режим
  - Синхронізація

- [ ] **Тестування**
  - Unit тести (Jest/Vitest)
  - E2E тести (Cypress/Playwright)
  - API тестування

#### Phase 3 - Maintenance:
- [ ] Documentation (JSDoc, API docs)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Performance optimization
- [ ] Security audit

---

## 🔒 Безпека

| Аспект | Статус | Примітка |
|--------|--------|---------|
| Environment переменные | ⚠️ Налаштовується | `.env` не завантажено в repo |
| CORS middleware | ✅ Включено | Дозволено всі origin (потребує рестрикції) |
| TypeScript strict | ✅ Ввімкнено | Повна type-safety |
| Password хеширование | ⚠️ Потребує уважання | Не видно в коді, потребує перевірки |
| Database pooling | ✅ Реалізовано | asyncpg з 2-10 connection діапазоном |

---

## 📈 Commit History

| Дата | Автор | Повідомлення |
|------|-------|------------|
| 26.05.2026 09:11 | Vova Vatsko | "Connect all endpoints to real API, remove all demo data" |
| 26.05.2026 05:17 | Vova Vatsko | "Add bbq-factory-os frontend" |
| 26.05.2026 04:51 | Vova Vatsko | "Clear repository" |

---

## 🚀 Швидкий старт

### Frontend Setup
```bash
cd bbq-factory-os
npm install
npm run dev      # Розробка: http://localhost:5173
npm run build    # Production build
npm run preview  # Preview production build
```

### Backend Setup
```bash
cd bbq-api
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

# Налаштуйте .env файл (див. .env.example)
pip install -r requirements.txt
python main.py
```

---

## 📝 Рекомендації для розвитку

### 🎯 Приоритетні завдання:

1. **✋ Обмеження CORS**
   ```python
   # Змінити з ["*"] на specifics hosts
   allow_origins=["https://grill-master-hub.vercel.app", "localhost:3000"]
   ```

2. **🔐 Безпека паролей**
   - Додати bcrypt для хеширування паролів
   - Реалізувати JWT токени
   - Додати refresh token logic

3. **📚 Тестування**
   - Додати unit тести для API endpoints
   - Написати E2E тести для критичних user flows

4. **📖 Документація**
   - Додати JSDoc коментарі
   - Написати API documentation (Swagger/OpenAPI)
   - Додати SETUP guide для нових розробників

5. **⚡ Оптимізація**
   - Database query optimization
   - Frontend bundle analysis
   - Caching strategies

6. **🔍 Мониторинг**
   - Додати логування
   - Error tracking (Sentry)
   - Performance monitoring

---

## 📞 Контакти & Матеріали

- **Автор:** Vova Vatsko (vatsko.vova@gmail.com)
- **Production URL:** https://grill-master-hub.vercel.app
- **Repository:** https://github.com/bassoonmario/grill-master-hub
- **Deploy Platform:** Vercel

---

## 📋 Метаінформація

**Паспорт створено:** 02.06.2026  
**Версія паспорту:** 1.0  
**Тип документу:** Repository Passport (markdown)  
**Статус:** ✅ Актуальний

---

*Last Updated: 02.06.2026 | Automated by GitHub Copilot*
