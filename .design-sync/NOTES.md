# Design Sync Notes — Grill Master Hub

## Repo quirks

- This is a React application (bbq-factory-os), not a published library. No dist/ — converter runs in synth-entry mode via a manually created barrel at `bbq-factory-os/src/components/index.ts`.
- Package has `"noEmit": true` in tsconfig, so no .d.ts files exist. All 11 components are listed explicitly in `componentSrcMap`.
- CSS is compiled Tailwind (`tailwind.out.css`, gitignored). Rebuild via `buildCmd` before re-sync.
- Fonts (Cormorant Garamond, Rajdhani, JetBrains Mono) are served from Google Fonts at runtime — `runtimeFontPrefixes` set, no font files shipped.

## Known render warns

- **AlertBanner** `[RENDER_ERRORS]` — pageerror message "...УВАГА" is the component's own rendered text content being captured by Playwright's pageerror listener (likely from emoji `⚠️` in headless chromium). Screenshot renders correctly (22KB). Non-blocking per [RENDER_ERRORS] tag; root non-empty. Expected on every re-sync.
- **ReplenishModal** `[RENDER_THIN]` — `fixed inset-0` positioning causes measured height to be 0px (viewport-relative positioning isn't measured by the card harness). Screenshot renders (8KB content). Non-blocking; bad=False. Expected on every re-sync.

## Re-sync risks

- `tailwind.out.css` is a build artifact. Run `buildCmd` before converter if app CSS changed.
- Components in `componentSrcMap` must be kept in sync manually if new components are added to the app — no auto-discovery (no dist/.d.ts).
- The barrel file `bbq-factory-os/src/components/index.ts` was created for this sync — don't delete it.
- InventoryCheckModal and ReplenishModal call `api.*` on form submit — these will fail in preview if the API is unreachable, but static display works correctly.
- Tailwind config's custom colors (in tailwind.config.js) differ slightly from the CSS variables in index.css (e.g. `--orange` in CSS = `#c9963a` but Tailwind `orange.DEFAULT` = `#ff5c1a`). Components use CSS vars directly via `var(--orange)`.
