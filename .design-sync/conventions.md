# Grill Master Hub — Design Conventions

## Wrapping and setup

No top-level provider is required. Components render standalone — `Tabs`, `StatCard`, `Card`, `StatusTag`, `ProgressBar`, `AlertBanner`, `EmptyState`, `SectionTitle`, and `Spinner` need no wrapper.

`InventoryCheckModal` and `ReplenishModal` are dialog overlays. Pass a non-null `item` prop to display the open state. They use `fixed inset-0` positioning, so wrap them in a `position: relative` container with `transform: scale(1)` to contain the dialog within its card:

```jsx
<div style={{ position: 'relative', height: 500, overflow: 'hidden', transform: 'scale(1)' }}>
  <ReplenishModal item={item} onClose={() => {}} onSuccess={() => {}} />
</div>
```

## Styling idiom — CSS custom properties

All color and surface tokens live as CSS custom properties on `:root`. Reference them directly via `var(--name)`. Never use raw hex; token values are the source of truth.

**Color palette:**
| Token | Role |
|---|---|
| `var(--bg)` | page background (`#080808`) |
| `var(--surface)` | card/panel surface |
| `var(--surface2)` | elevated surface |
| `var(--border)` | border color |
| `var(--orange)` | primary accent (gold-orange `#c9963a`) |
| `var(--orange-dim)` | tinted orange bg (`#c9963a28`) |
| `var(--orange-mid)` | orange border mid (`#c9963a66`) |
| `var(--text)` | primary text |
| `var(--text-dim)` | secondary/muted text |
| `var(--text-mid)` | mid-emphasis text |
| `var(--green)` / `var(--green-dim)` | success |
| `var(--yellow)` | warning |
| `var(--red)` / `var(--red-dim)` | destructive/critical |

Layout glue uses Tailwind utilities (`flex`, `gap-*`, `p-*`, `rounded-xl`, etc.). Typography: `font-display` (Cormorant Garamond serif), `font-mono` (JetBrains Mono), `font-sans` / body (Rajdhani sans-serif).

## Component API highlights

**Tabs** — `variant`: `"pill"` (default dark container), `"underline"` (border-bottom active), `"chip"` (scrollable rounded chips). Pass `tabs: TabItem[]`, `active: string`, `onChange`.

**StatCard** — `accent`: `"orange" | "green" | "yellow" | "red"`. Add `wide` prop for 2-column grid span.

**StatusTag** — `type`: `"new" | "active" | "progress" | "done" | "pending"`. Labels are Ukrainian.

**AlertBanner** — `level`: `"warning" | "critical"`. Always provide `text`.

**ProgressBar** — requires `pct` (0–100) and `label`. Optional `subleft`/`subright` footnotes.

## Where the truth lives

- Token variables: read `_ds_bundle.css` (compiled from `src/index.css`)
- Component docs: `components/general/<Name>/<Name>.prompt.md`
- Bundle: `window.GrillMasterHub.<ComponentName>`

## Idiomatic build snippet

```jsx
// Stat grid with Card layout
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16, background: 'var(--bg)' }}>
  <StatCard icon={<Flame className="w-5 h-5" />} value={42} label="Гриль-сесії" accent="orange" />
  <StatCard icon={<Package className="w-5 h-5" />} value={128} label="На складі" accent="green" />
  <AlertBanner text="Вугілля на межі мінімуму" level="warning" />
</div>
```
