# Grill Factory OS — Design Guide

Цей файл — інструкція для внесення змін по дизайну. Вклей його вміст в Claude chat перед тим як просити правити UI.

---

## Стек

- **Tailwind CSS** + **CSS Custom Properties** (CSS змінні)
- **React** + **TypeScript**
- Шрифти: Google Fonts (завантажуються в `index.css`)

---

## Ключові файли — де що правити

| Що хочеш змінити | Файл |
|---|---|
| Кольори акцентів, фони, межі | `src/index.css` → блок `:root` |
| Шрифти | `src/index.css` → `@import` + `body` |
| Компоненти (картки, таби, теги, спінер...) | `src/components/UI.tsx` |
| Хедер і загальний layout сторінки | `src/components/Layout.tsx` |
| Нижня навігація | `src/components/BottomNav.tsx` |
| Конкретна сторінка | `src/pages/<Name>.tsx` |

---

## Кольорові токени (`src/index.css`)

Всі кольори живуть у блоці `:root`. Змінити один токен = змінити його скрізь в застосунку.

```css
:root {
  /* Фони (від темнішого до світлішого) */
  --void:     #080808;   /* найтемніший фон, body */
  --carbon:   #111009;   /* поверхня карток (surface) */
  --ember:    #1a1510;   /* поверхня 2 рівня (surface2) */
  --wood:     #221c12;   /* рідко, глибокі панелі */

  /* Межі та текст */
  --ash:      #3a3530;   /* border */
  --smoke:    #5a5248;   /* text-dim (приглушений текст) */
  --mist:     #9a9088;   /* text-mid */
  --ivory:    #e8e0d0;   /* text (основний текст) */

  /* Акцент — золото/бронза */
  --gold:     #c9963a;   /* основний акцент */
  --gold-dim: #c9963a28; /* фон акцентних елементів */
  --gold-mid: #c9963a66; /* межа акцентних елементів */

  /* Металік */
  --steel:    #8a9ba8;   /* вторинний акцент */

  /* Статуси */
  --red:      #8b2020;
  --red-dim:  #8b202028;
  --green:    #2a6b3a;
  --green-dim:#2a6b3a28;

  /* Аліаси (використовуються в коді через var(--orange), var(--bg) тощо) */
  --bg:        var(--void);
  --surface:   var(--carbon);
  --surface2:  var(--ember);
  --border:    var(--ash);
  --orange:    var(--gold);      /* в коді пишуть var(--orange) — це золото */
  --orange-dim:var(--gold-dim);
  --orange-mid:var(--gold-mid);
  --text:      var(--ivory);
  --text-dim:  var(--smoke);
  --text-mid:  var(--mist);
}
```

> **Порада:** щоб змінити акцент-колір по всьому застосунку — зміни тільки `--gold`, `--gold-dim`, `--gold-mid`.

---

## Шрифти

```css
/* src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

body {
  font-family: 'Rajdhani', sans-serif;   /* основний текст */
}
```

| Клас Tailwind | Шрифт | Використання |
|---|---|---|
| `font-sans` або без класу | Rajdhani | основний текст, кнопки |
| `font-display` | Cormorant Garamond | великі числа, заголовки |
| `font-mono` | JetBrains Mono | коди, мітки, теги, навігація |

---

## Компоненти (`src/components/UI.tsx`)

Всі імпортуються так:
```tsx
import { StatCard, Card, Tabs, ... } from '@/components/UI'
```

---

### `<StatCard>` — картка зі статистикою

```tsx
<StatCard
  icon={<SomeIcon className="w-4 h-4" />}
  value="42"           // велике число або рядок
  label="Зроблено"     // підпис під числом
  accent="orange"      // 'orange' | 'green' | 'yellow' | 'red'
  wide={false}         // true = займає 2 колонки
/>
```

---

### `<Card>` — проста картка-обгортка

```tsx
<Card className="p-5">
  Будь-який вміст
</Card>
```

---

### `<Tabs>` — вкладки (3 варіанти)

```tsx
const tabs = [
  { key: 'one', label: 'Перша', icon: <SomeIcon size={14} /> },
  { key: 'two', label: 'Друга' },
]

<Tabs
  tabs={tabs}
  active={activeTab}
  onChange={key => setActiveTab(key)}
  variant="pill"       // 'pill' | 'underline' | 'chip'
/>
```

| Варіант | Вигляд | Де використовується |
|---|---|---|
| `pill` | темний контейнер, пілюлі всередині | Tasker, AdminTasker |
| `underline` | підкреслення активної вкладки | Dashboard |
| `chip` | скролювані округлі чіпи | Warehouse |

---

### `<SectionTitle>` — заголовок секції

```tsx
<SectionTitle>Назва секції</SectionTitle>
```
Виглядає: дрібний моно-шрифт, caps, з відступом зверху.

---

### `<StatusTag>` — статус-тег

```tsx
<StatusTag type="new" />      // НОВЕ
<StatusTag type="progress" /> // В РОБОТІ
<StatusTag type="done" />     // ВИКОНАНО
<StatusTag type="pending" />  // ОЧІКУЄ
<StatusTag type="active" />   // АКТИВНО
```

---

### `<ProgressBar>` — прогрес-бар

```tsx
<ProgressBar
  pct={75}
  label="Виконання плану"
  subleft="Залишилось: 3 дні"
  subright="Залишилось: 120 шт"
/>
```

---

### `<AlertBanner>` — банер-попередження

```tsx
<AlertBanner text="Критична помилка!" level="critical" />
<AlertBanner text="Зверніть увагу" level="warning" />
```

---

### `<EmptyState>` — порожній стан

```tsx
import { ClipboardCheck } from 'lucide-react'

<EmptyState
  icon={<ClipboardCheck size={36} strokeWidth={1.2} />}
  text="Немає завдань"
/>
```

---

### `<Spinner>` — лоадер

```tsx
<Spinner />
```

---

## Як змінити конкретні речі

### Змінити акцент-колір (золото → синій)
```css
/* src/index.css */
:root {
  --gold:     #2563eb;
  --gold-dim: #2563eb28;
  --gold-mid: #2563eb66;
}
```

### Змінити основний шрифт
```css
/* src/index.css */
@import url('... новий шрифт ...');
body { font-family: 'Новий Шрифт', sans-serif; }
```
```js
// tailwind.config.js
fontFamily: { sans: ['"Новий Шрифт"', 'sans-serif'] }
```

### Змінити стиль карток (StatCard, Card)
Правити компоненти в `src/components/UI.tsx`.

### Змінити стиль активної вкладки (Tabs)
У `UI.tsx` в компоненті `Tabs` — знайди потрібний `variant` і зміни класи активного стану.

### Додати новий статус-тег
У `UI.tsx` додай новий ключ в `TAG_STYLES` і `TAG_LABELS`.

---

## Іконки

Використовується бібліотека `lucide-react`. Всі іконки:
```tsx
import { Home, Truck, AlertTriangle, Check, ... } from 'lucide-react'
<Truck size={16} className="w-4 h-4" />
```

Список всіх іконок: https://lucide.dev/icons/
