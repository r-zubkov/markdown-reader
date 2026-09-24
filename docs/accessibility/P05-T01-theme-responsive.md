# P05-T01 theme and responsive UI evidence

## Accepted implementation

- The global preference remains `system | light | dark` in IndexedDB, with `localStorage` used only as the pre-paint mirror.
- The same-origin external bootstrap applies the mirrored theme synchronously before the React entry is allowed to load. Repository reconciliation then restores the canonical preference without overwriting a newer user selection.
- OS color-scheme changes update an active `system` preference and dispatch the Reader layout-preservation handshake.
- Central light/dark roles cover app, surface, reader, text, muted text, border, accent, accent hover, success, warning, danger, code, selection, elevation and named layers.
- Markdown prose owns namespaced typography, headings, blockquotes, links, inline/fenced code, syntax roles, tables, images, task controls and local overflow.
- Reader theme and viewport changes pin a stable target or semantic block, remeasure the virtualizer and restore focus and position after stabilization.

## Responsive and visual matrix

| Evidence | Result |
|---|---|
| 320 x 640 compact Library/header | No page overflow; every header target is at least 44 x 44 CSS px; axe passes. This is also the reflow branch used by a 1280 CSS px layout at 400% browser zoom. |
| 320 x 844 to 844 x 390 Reader resize | Responsive composition crosses the mobile/tablet boundary while retaining the locked semantic heading within the 96 px budget; the final complete run measured 10.83 px and focused-theme runs measured 0 px. Five repeated focused resize runs also passed. |
| 390 px mobile Sheet and 1280 px persistent TOC | Covered by the complete TOC/deep-link and full Chromium suites; focus returns and no page overflow occurs. |
| Light and dark Library at 1280 x 900 | Stable Playwright screenshot baselines and axe scans pass in both themes. |
| Forced colors and reduced motion at 320 x 640 | Chromium emulation confirms both media queries, a visible 2 px focus outline, transitions no longer than 0.1 ms and no page overflow. |
| Long code/table/image and large Reader corpus | Local overflow, bounded DOM/cache, media fallback and anchor remeasurement pass in the complete Chromium suite. |

Visual baselines are stored beside `e2e/theme-responsive.spec.ts`. The UI retains the specified quiet technical-editorial direction: list-based Library, uncarded Reader surface, one accent family and utility-first chrome without dashboard or bookshelf decoration.

## Verification record

- TypeScript build graph: passed.
- ESLint: passed.
- Vitest: 26 files, 136 tests passed.
- Security suite: 3 tests passed.
- Benchmark suite: 4 files, 6 tests passed when run without competing corpus jobs. The initial parallel invocation hit two existing 5-second benchmark timeouts; the isolated required benchmark command passed.
- Production build: passed; the existing main-chunk size advisory remains non-blocking.
- Playwright Chromium with one worker and separately managed Vite: all 37 tests passed, including both-theme screenshots/axe, forced colors, reduced motion and Reader remeasurement.

## Font and bundle decision

No font files or dependencies were added. The accepted system fallbacks remain `Inter/ui-sans-serif`, `Charter/Georgia` and `ui-monospace/Consolas`. This avoids new network requests and bundle weight while preserving the typography contracts; optional self-hosted brand fonts remain a future brand decision.

## Deviations and residual decisions

- The final brand accent is still the documented replaceable neutral-blue placeholder (`OPEN-001`).
- Browser zoom is represented by the equivalent 320 CSS px reflow branch because browser chrome zoom controls are not exposed by the sandboxed headless Chromium runner. P05-T04 later closed its NVDA and real browser-zoom manual gates through explicit user-approved waivers; optional physical Android smoke remains outside the MVP release gate.
- No architecture, storage schema, worker protocol, sanitizer contract, pipeline version or dependency changed.
