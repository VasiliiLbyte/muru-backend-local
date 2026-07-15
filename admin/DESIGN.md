# MURU Admin — Design System

CRM admin SPA (`admin/`). Visual layer only — business logic lives in `lib/*-api.ts` and backend services.

## Tokens

All design values are CSS custom properties in [`src/styles/tokens.css`](src/styles/tokens.css). **Hex literals exist only in that file.**

| Variable | Value | Purpose |
|----------|-------|---------|
| `--muru-olive` | `#5d6b3a` | Primary brand, buttons, active nav, accents |
| `--muru-olive-soft` | `#6b7350` | Hover states |
| `--muru-ivory` | `#f5f0e0` | Sidebar background |
| `--muru-text` | `#2c2c2c` | Body text |
| `--muru-text-strong` | `#111827` | Emphasis |
| `--muru-accent` | `#d4c4a8` | Hotspot markers, secondary borders |
| `--muru-app-bg` | `#faf8f2` | Page background |
| `--muru-surface` | `#ffffff` | Cards, inputs, tables |
| `--muru-surface-muted` | `#f9fafb` | Subtle row backgrounds |
| `--muru-muted` | `#6b7280` | Helper text (`.muted-text`) |
| `--muru-muted-light` | `#9ca3af` | Disabled sidebar items |
| `--muru-success` | `#4a7c59` | Success semantic |
| `--muru-warning` | `#b8860b` | Warning semantic |
| `--muru-danger` | `#a4442e` | Errors, destructive actions |
| `--muru-border` | `#e5e7eb` | Default borders |
| `--muru-border-input` | `#d1d5db` | Input borders |
| `--muru-success-bg/text` | green pair | Success badges, toasts |
| `--muru-warning-bg/text/border` | amber pair | Warning banners |
| `--muru-info-bg/text` | blue pair | Channel badges |
| `--muru-purple-bg/text` | purple pair | Cross-placement badges |
| `--r-sm/md/lg/pill` | `8/12/16/999px` | Border radii |
| `--shadow-sm/md/lg` | rgba shadows | Elevation |
| `--font-body` | Montserrat | UI text |
| `--font-display` | Cormorant Garamond | Headings, login |
| `--motion-fast/base/slow` | `0.15/0.25/0.45s` | Transitions |
| `--focus-ring` | olive glow | `:focus-visible` |

## CSS architecture

```
src/styles/index.css
  → tokens.css   (variables, muru-rise keyframes)
  → base.css     (reset, .muted-text, .error-text, .sr-only, reduced-motion guard)
  → components.css (ui kit, layout, page utilities)
```

- Use `var(--…)` for colors, spacing, radii, motion — never hardcode hex in components or page CSS.
- Page-specific layout classes (e.g. `.orders-pagination`, `.filters-panel`) live in `components.css`.

## UI components (`src/components/ui/`)

| Component | Purpose |
|-----------|---------|
| `Button` | `primary` / `secondary` / `ghost` / `danger`; loading spinner |
| `IconButton` | Icon-only actions in tables and toolbars |
| `Field` | Label + error slot for form controls |
| `Input`, `Textarea`, `Select` | 40px-height form controls |
| `Checkbox` | Custom olive checked state |
| `Badge` | Pill + optional dot; `success` / `warning` / `danger` / `neutral` |
| `Card`, `CardHeader` | Bordered content sections |
| `Tabs`, `TabsList`, `TabsTrigger` | NavLink tabs with olive underline |
| `Table`, `TableHead/Body/Row/Cell` | Data tables with `.muru-table-wrap` |
| `PageHeader` | Title, back link, action slot |
| `Skeleton`, `SkeletonText`, `SkeletonTable`, `SkeletonForm` | Loading placeholders |
| `EmptyState` | Empty list with icon + optional CTA |
| `Toast`, `ToastProvider`, `useToast` | Non-blocking notifications |
| `ConfirmDialog`, `ConfirmProvider`, `useConfirm` | Destructive action confirmation |
| `PromptDialog`, `PromptProvider`, `usePrompt` | Text input dialogs (TipTap URLs) |
| `ImageUploader` | Preview + replace/remove; hidden file input |
| `FileDropzone` | Drag-and-drop file picker |

Import from `components/ui` (barrel `index.ts`). Do not duplicate primitives in page files.

## Rules (mandatory for all `admin/` work)

1. New UI elements — **only** from `components/ui/`.
2. Colors and spacing — **only** `var(--…)` from `tokens.css`.
3. `window.confirm` / `alert` / `window.prompt` — **forbidden**; use `useConfirm`, `useToast`, `usePrompt`.
4. File inputs — **only** `ImageUploader` / `FileDropzone` (no raw `<input type="file">` in pages).
5. Every list page: `PageHeader` + `Skeleton*` on load + `EmptyState` when empty + `toast` on save/delete.
6. No hex in TSX or CSS outside `tokens.css`.
7. **Read this file** before any `admin/` change.

## Contrast notes (WCAG 2.1 AA audit, 2026-07-15)

| Pair | Ratio | Result | Notes |
|------|-------|--------|-------|
| `--muru-text` on `--muru-ivory` | 12.25:1 | Pass AA | Sidebar inactive links |
| `--muru-olive` on `--muru-ivory` | 5.08:1 | Pass AA | Sidebar brand title (large) |
| `--muru-olive` on `--muru-app-bg` | 5.45:1 | Pass AA | Active tabs, dashboard icons |
| `--muru-surface` on `--muru-olive` | 5.79:1 | Pass AA | Primary buttons, active sidebar, order status tabs |
| `--muru-muted` on `--muru-app-bg` | 4.55:1 | Pass AA | Helper text |
| ~~`--muru-olive` on `--muru-olive-soft`~~ | 1.16:1 | **Was fail** | Fixed in UI-4: `.orders-status-tab--active` now uses olive bg + white text |

No token changes required beyond the active-tab CSS fix.

## Motion

`@media (prefers-reduced-motion: reduce)` disables:

- `muru-rise` entrance animation (`tokens.css`)
- `muru-spin` on `.muru-btn__spinner` and `.muru-spinner` (`components.css`)
- `muru-shimmer` on Skeleton (`components.css`)
- Tab underline `transform` transition (`.muru-tabs__trigger::after`)
- Global `animation` / `transition` durations (`base.css` guard)

Toasts are static (no enter/exit animation) — compliant by default.
