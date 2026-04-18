# Task 298 — WCAG 2.1 AA compliance review (admin surface)

Scope: the admin console under `/admin/**` introduced in batch 12. Findings
are consolidated here rather than file-by-file so subsequent contributors
can track progress in one place.

## Summary

The seed admin UI satisfies the core WCAG 2.1 AA success criteria listed
below. Items marked **(deferred)** are acknowledged gaps that require
product direction (e.g. a theme toggle) or non-trivial library work; they
are tracked separately in the roadmap.

## Checklist

- **1.1.1 Non-text content** — every navigation link has a visible text
  label; data tables carry `aria-label` (e.g. "Users list"); informational
  banners use `role="alert"`.
- **1.3.1 Info and relationships** — tables use semantic `<thead>/<th>`;
  headings (`<h1>`, `<h2>`) follow a single-level-per-page hierarchy.
- **1.4.3 Contrast** — the light theme uses `#0f172a` on `#f8fafc`
  (contrast ≥ 14:1). Dark theme uses `#e5e7eb` on `#0b0f19` (≥ 15:1). Status
  badges (`#fef3c7` warnings) rely on adjacent text for meaning.
- **1.4.10 Reflow** — the admin shell grid collapses at ≤1080px and tables
  scroll horizontally inside `overflow-x: auto` wrappers (existing
  `.audit-table-wrap` pattern applied globally).
- **2.1.1 Keyboard** — every interactive element (`<a>`, `<button>`, form
  fields) is reachable via Tab order; no custom keybindings intercept
  focus.
- **2.4.4 Link purpose** — sidebar links carry descriptive text; no
  "click here" copy.
- **3.2.2 On input** — none of the seed admin pages submit on change.
- **4.1.2 Name/role/value** — native elements are used throughout; no ARIA
  overrides.

## Deferred

- **1.4.11 Non-text contrast** for the custom status chips — current
  yellow/green/red pairings pass in light mode but the dark-mode overrides
  inherit slightly lower chroma. Queued behind the design-token refresh.
- **2.4.7 Focus visible** — we rely on the browser's default focus ring.
  A branded focus-ring treatment will land with the design system work in
  batch 13.
- **3.3.3 Error suggestion** — Zod failures currently surface as a generic
  400 message; admin forms will expose field-level hints once the admin
  write endpoints replace the preview-token pattern.

## Tooling notes

- Storybook's `@storybook/addon-a11y` (configured in
  `.storybook/preview.ts`) runs axe-core on every story in CI once
  Storybook is installed. The `.storybook` config is currently stubbed —
  run `npm i -D @storybook/nextjs @storybook/react @storybook/addon-a11y`
  to activate.
- Playwright snapshot tests for the admin routes live in
  `apps/web/e2e/admin.spec.ts` and assert landmark roles (`main`,
  `navigation`) and an `h1` per page.
