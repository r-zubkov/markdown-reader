# P03-T02 production continuous reader

Status: **complete for the DEC-022 Chromium-only MVP matrix**.

Measured on 2026-09-13 in the Windows Codex sandbox with the repository-pinned Node, pnpm, TanStack Virtual and Playwright versions. Browser verification used the separately running Vite server required by `AGENTS.md`.

## Production configuration

| Concern | Value |
|---|---:|
| Adapter | `useWindowVirtualizer` with document/window scrolling |
| Overscan | 8 chunks per side |
| Initial repository window | 24 chunks |
| Subsequent range request | 32 chunks |
| Cache hard limit | 96 entries |
| Mounted wrapper budget | 48 |
| Stable key | `versionId:ordinal` |
| Scroll padding | 72 CSS px |
| Anchor tolerance | 96 CSS px |
| `useFlushSync` | `false` |
| Direct DOM updates | off |

The production repository now issues a compound `[versionId+ordinal]` IndexedDB range query instead of loading every version chunk and filtering in memory. Each validated DTO carries branded sanitized HTML, semantic anchors, estimated cost and safe-fallback diagnostics. Batch validation failures are retried as single-record reads so one corrupt record becomes a local placeholder while valid neighbors remain readable. Stale pipeline, missing document and database failures remain fatal controlled states.

The viewport keeps only bounded DTOs outside React state, uses stable virtual keys, pins the focused ordinal and memoizes `SafeHtmlChunk` so measurement renders cannot destroy focus. A far target remains locked through asynchronous measurement until actual user wheel, touch, pointer or reading-navigation key input. Theme and viewport-size changes pin and restore the observed semantic chunk. `ObservedLocation` exposes chunk ordinal, semantic anchor and source progress to P03-T04.

## Evidence

The Node benchmark ran the existing deterministic large Markdown corpus through the production parser, sanitizer and batching pipeline, staged it in the production Dexie repository and read all 181 chunks in order through the bounded cache. The recorded targeted run took 117.15 ms for staging plus range traversal and ended at the 96-entry cache limit.

The production Chromium corpus uses the real import Worker/pipeline and creates 220 heading chunks plus mixed prose, wide code and remote media. Its sequential first/middle/last run recorded:

| Metric | Result | Budget |
|---|---:|---:|
| Mounted chunk wrappers | 16 | at most 48 |
| Cached Reader entries | 82 | at most 96 |
| Longest uncovered viewport interval | 0 ms | at most 100 ms |
| Longest main-thread task | 58 ms | at most 150 ms |
| Theme-change target drift | 0.09 px | at most 96 px |

The browser matrix also passed a direct middle restore after reload, first/middle/last TOC navigation, a disjoint focused-link pin, remote-image error localization, 320 px page-overflow checks and a 320x844 to 844x390 resize/orientation transition within the 96 px assertion tolerance. The continuous-reader scenarios passed twice sequentially during stability testing.

P05-T04 repeated the same production benchmark after adding fail-closed persisted-HTML validation. The 181-chunk staging and bounded traversal completed in 210.79 ms with 96 cached entries, below the unchanged 5,000 ms regression budget. The corresponding Chromium first/middle/last run retained 16 mounted chunks, reported no blank interval and measured a 59 ms longest main-thread task against the unchanged 150 ms budget.

## Verification record

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — 19 files and 99 tests passed.
- `pnpm test:security` — 3 tests passed.
- `pnpm test:bench` — 4 files and 6 tests passed.
- `pnpm build` — passed; PWA assets generated.
- `playwright test e2e/continuous-reader.spec.ts --project=chromium --workers=1` — 3 passed.
- `playwright test` against separately managed Vite — 25 passed after aligning the pre-existing production-pipeline E2E with the intended success-overlay Open action.

## Residual scope

P03-T03 adds sections, split-strategy settings and the complete external-media policy surface. P03-T04 consumes `ObservedLocation` for throttled automatic persistence and confidence-aware restoration. The explicit save-position control remains as the P01 compatibility path until P03-T04 replaces it.
