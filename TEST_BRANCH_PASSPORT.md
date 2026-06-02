# 📋 ПАСПОРТ РЕПОЗИТОРІЮ - grill-master-hub [TEST-BRANCH]

**Гілка:** `test-branch`  
**Дата створення:** 26.05.2026  
**Останнє оновлення:** 26.05.2026  
**Статус:** 🟡 Тестування  
**Мова:** TypeScript / Python  
**Автор:** Vova Vatsko (vatsko.vova@gmail.com)  

---

## ℹ️ Інформація про гілку

| Параметр | Значення |
|----------|----------|
| Останній комміт | `f810df853a23c6a1ecf797299419d3485ba4d442` |
| Mensaje комміту | "Connect all endpoints to real API, remove all demo data" |
| Базова гілка | `main` |
| Захищена | ❌ Ні |

---

## 🎯 Опис гілки TEST-BRANCH

**test-branch** — це експериментальна гілка для тестування нових функціоналів та змін перед їх інтеграцією до main гілки.

На поточний момент **test-branch** має той же стан що й main, оскільки обидві вказують на останній комміт.

---

## 📊 Статистика

| Метрика | Значення |
|---------|----------|
| Гілок від цієї | 0 |
| Комітів (спільних з main) | 3 |
| Файлів | ~20+ (оцінка) |
| Розмір | 44 KB |

---

## 🏗️ Структура проекту на test-branch

```
test-branch/
├── bbq-api/                    # Backend API (Python + FastAPI)
│   ├── main.py                 # API endpoints
│   ├── .env.example            # Конфігурація
│   └── requirements.txt        
│
└── bbq-factory-os/             # Frontend (React + TypeScript)
    ├── src/
    │   ├── main.tsx            # React entry point
    │   ├── App.tsx             # Main component
    │   ├── pages/
    │   │   ├── Login.tsx       # Login page
    │   │   ├── Tasker.tsx      # Task management
    │   │   └── [інші сторінки]
    │   ├── components/
    │   │   ├── Layout.tsx      # Main layout
    │   │   ├── BottomNav.tsx   # Navigation
    │   │   └── [інші компоненти]
    │   ├── context/
    │   │   └── AuthContext.tsx # Auth state
    │   ├── api.ts              # HTTP client
    │   └── vite-env.d.ts
    ├── tailwind.config.js      # Tailwind
    ├── vite.config.ts          # Vite config
    ├── tsconfig.json           # TypeScript
    ├── package.json            # Dependencies
    └── index.html              # Template
```

---

## 🔧 Технічний стек test-branch

### Frontend Dependencies
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.0",
  "lucide-react": "^0.383.0",
  "tailwindcss": "^3.4.7",
  "vite": "^5.4.1",
  "typescript": "^5.5.3"
}
```

### Backend Stack
- **FastAPI** - Web framework
- **asyncpg** - PostgreSQL async driver
- **Python 3.x** - Runtime

---

## ✨ Реалізовані функції на test-branch

### 🟢 Готово:

#### 1. Автентифікація
- ✅ Login форма (email/пароль)
- ✅ 3 ролі користувачів (Admin, Master, Driver)
- ✅ Auth context & state management
- ✅ Logout функціональність

#### 2. API Endpoints
- ✅ `/health` — health check
- ✅ `/api/stock` — отримання інвентарю
- ✅ `/api/tasker/cards` — список завдань
- ✅ `/api/tasker/confirm/{cardId}` — підтвердження завдання

#### 3. Управління Складом
- ✅ 4 категорії інвентарю
- ✅ Статус товарів (ok/low/critical)
- ✅ Мінімальні ліміти запасу

#### 4. Управління Завданнями
- ✅ Список дорученнь з чекліста
- ✅ Статуси: new, progress, done
- ✅ Interactive checkbox UI
- ✅ Real-time оновлення

#### 5. UI Components
- ✅ Dark theme (#0a0a0a фон)
- ✅ Custom color palette (orange #ff5c1a)
- ✅ Responsive layout
- ✅ Bottom navigation
- ✅ Top header bar

#### 6. Database
- ✅ PostgreSQL connection pooling
- ✅ Async queries (asyncpg)
- ✅ Цикл-based логіка (1-15 / 16-кін)

---

## 🧪 Що тестувати на test-branch?

### API Тестування:
```bash
# Health check
curl http://localhost:8000/health

# Stock endpoint
curl http://localhost:8000/api/stock

# Login flow
POST /api/auth/login
```

### Frontend Тестування:
- [ ] Login форма валідація
- [ ] Role-based UI rendering
- [ ] Tasker функціональність (add/complete tasks)
- [ ] Stock список та фільтрація
- [ ] Navigation between pages
- [ ] Mobile responsiveness

### Regression Тестування:
- [ ] Попередні комміти не ламаються
- [ ] Database connection stable
- [ ] API responses consistent

---

## 🚀 Команди для роботи з test-branch

```bash
# Перейти на test-branch
git checkout test-branch

# Оновити локальну гілку з remote
git pull origin test-branch

# Створити нову feature гілку від test-branch
git checkout -b feature/new-feature test-branch

# Перемістити зміни в main після тестування
git checkout main
git pull origin main
git merge test-branch

# Запустити фронтенд для тестування
cd bbq-factory-os
npm run dev

# Запустити бекенд для тестування
cd bbq-api
python main.py
```

---

## 📝 Відмінності test-branch від main

### Поточний стан:
**⚠️ На даний момент test-branch та main мають однаковий вміст** (обидві вказують на останній комміт `f810df853a23c6a1ecf797299419d3485ba4d442`)

### Рекомендовані тест-сценарії:

#### Scenario 1: UI Testing
1. Запустити фронтенд
2. Увійти з демо-акаунтом
3. Перевірити всі сторінки роблять
4. Протестувати на різних екранах

#### Scenario 2: API Testing
1. Запустити бекенд
2. Перевірити endpoints връщають коректні дані
3. Тестувати error handling
4. Load тести

#### Scenario 3: Integration Testing
1. Frontend + Backend разом
2. Real API calls (не mock data)
3. Data persistence перевірка
4. Session management

---

## 🔒 Безпека на test-branch

| Компонент | Статус | Дія |
|-----------|--------|-----|
| CORS | ⚠️ Відкритий | Рестриктувати для production |
| Passwords | ⚠️ Потребує аудиту | Додати bcrypt хеширування |
| JWT Tokens | ❌ Відсутні | Впровадити для better security |
| ENV vars | ✅ OK | .env не в repo |
| DB Connection | ✅ Pooled | Secure connection strings |

---

## 📋 Чеклист перед merge до main

Перед тим як merge test-branch → main, перевірити:

- [ ] Всі API endpoints працюють
- [ ] Frontend не має console errors
- [ ] Database queries оптимізовані
- [ ] CORS налаштування закладені для production
- [ ] Немає hardcoded credentials
- [ ] Тести пройшли (якщо є)
- [ ] Code review пройшов
- [ ] Documentation оновлена

---

## 🔗 Важливі посилання

| Ресурс | Посилання |
|--------|----------|
| Гілка на GitHub | https://github.com/bassoonmario/grill-master-hub/tree/test-branch |
| Main гілка | https://github.com/bassoonmario/grill-master-hub/tree/main |
| Production | https://grill-master-hub.vercel.app |

---

## 📞 Інформація для розробників

```
Branch Owner: Vova Vatsko
Email: vatsko.vova@gmail.com

Frontend: React 18.3.1 + TypeScript
Backend: Python FastAPI
Database: PostgreSQL
Deployment: Vercel (Frontend)
```

---

## 📅 Історія комітів (test-branch)

| Дата | Автор | Комміт | Повідомлення |
|------|-------|--------|------------|
| 26.05.2026 09:11 | Vova Vatsko | f810df8... | Connect all endpoints to real API, remove all demo data |
| 26.05.2026 05:17 | Vova Vatsko | 9bf5d99... | Add bbq-factory-os frontend |
| 26.05.2026 04:51 | Vova Vatsko | e9abd29... | Clear repository |

---

## 💡 Рекомендації для test-branch

1. **Створити test suite** для всіх API endpoints
2. **Додати logging** для дебагу
3. **Налаштувати staging deployment** для pre-production тестування
4. **Написати acceptance criteria** для кожної функції
5. **Setup pre-commit hooks** для code quality checks

---

## 📚 Документація

**Основні файли:**
- `bbq-api/.env.example` — Backend конфігурація
- `bbq-factory-os/package.json` — Frontend залежності
- `bbq-api/main.py` — API source code
- `bbq-factory-os/src/` — React components

---

**Паспорт TEST-BRANCH: Версія 1.0**  
**Дата створення:** 02.06.2026  
**Статус:** ✅ Актуальний  
**Для гілки:** test-branch

---

*Документ автоматично створено для тестування та аудиту test-branch*
