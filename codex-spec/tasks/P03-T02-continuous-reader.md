# P03-T02 Production continuous reader

## Outcome

R-01 continuous mode uses the approved bounded virtual/window implementation to read the full large corpus with stable far jumps, dynamic measurement and focus.

## Why now

The spike-selected approach can now be integrated with real sanitized repository chunks and TOC resolution.

## Read before starting

`AGENTS.md`; `codex-spec/features/continuous-reader.md`; P00-T04 report; `codex-spec/design/screens-and-user-flows.md` R-01; `codex-spec/design/ui-design-system.md` reader content/overflow.

## Related requirements

PRD-006, PRD-010, TECH-011, UX-002, UX-005–008, NFR-001, NFR-005–006.

## Preconditions

P03-T01 and P00-T04 complete. Dependencies: P03-T01, P00-T04.

## Scope

- Integrate selected virtual/bounded adapter with `ReaderWindowPort` and current ready version.
- Implement stable keys, dynamic measurement, bounded fetch/cache/eviction, far heading/restore jump and progressive local states.
- Render via SafeHtmlChunk and `.reader-content`; implement code/table/image overflow/remeasure/media fallback baseline.
- Preserve/pin focus across window changes and expose observed semantic location to P03-T04.
- Add performance/browser/device regression using real pipeline corpus.

## Non-goals

No sections/strategies, final persistence throttle, search/browser-find promise, auto-hide toolbar or unapproved virtualizer options.

## Expected files

ReaderViewport/adapter/window cache, repository range integration, reader-content styles/media helpers, tests/benchmarks.

## Implementation notes

Configuration exactly follows spike decision and central limits. No whole-document `chunks[]`. Far jump loads target range. Any deviation from document scroll/adapter requires decision/report update.

## UI and states

Restoring, continuous ready, leading/trailing fetch, far jump, remeasure, safe fallback/corrupt chunk, remote media loading/error/offline.

## Edge cases

First/last/empty, huge node, image/theme/font/resize above viewport, rapid reverse, focused link/code control, stale derived data, 320 px wide code/table.

## Acceptance criteria

- [ ] Large corpus first/middle/last and TOC far targets are reachable in order without missing/duplicate content.
- [ ] DOM/cache/long-task/jump budgets match P00 report.
- [ ] Resize/image/theme changes and focus eviction scenarios stay within tolerance.
- [ ] Safe fallback/corrupt/media error localizes without breaking rest.
- [ ] Automated target browsers and physical iPhone continuous scenario pass.

## Required tests

Window/cache/adapter unit/component, real-corpus large E2E, TOC far jump, remeasure/focus/media/network tests, benchmark and device checklist.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bench`, `pnpm test:e2e:all`, `pnpm build`; record physical iPhone result.

## Completion report

Report config/budgets, full-content/focus/browser evidence, files, commands, deviations and P03-T04 integration port.
