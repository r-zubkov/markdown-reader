# P00-T04 Continuous virtual reader spike

## Outcome

A measurable large-reader prototype selects TanStack Virtual configuration or the documented bounded fallback for document scroll, dynamic content, far jumps and focus safety.

## Why now

Continuous reading is the highest UX/performance risk and must be proven before production Reader architecture hardens around it.

## Read before starting

`AGENTS.md`; `codex-spec/features/risk-spikes.md` Spike C; `codex-spec/features/continuous-reader.md`; `codex-spec/design/ui-design-system.md` grid/reader/accessibility; official TanStack links in `codex-spec/architecture/system-architecture.md`.

## Related requirements

PRD-006, PRD-010, TECH-011, UX-002, NFR-001, NFR-005, NFR-006; DEC-008, DEC-015.

## Preconditions

P00-T01 complete. Dependencies: P00-T01.

## Scope

- Generate 5k–20k heterogeneous safe chunk fixtures with stable keys and variable heights.
- Prototype document/window-scroll dynamic virtualization and repository-like bounded range/cache.
- Test restore/far jump, reverse/rapid scroll, late image, font/theme/width/orientation change and focused controls.
- Compare documented `useFlushSync` settings; evaluate `directDomUpdates` only with evidence; prototype bounded fallback if needed.
- Record mounted DOM/cache counts, long tasks, blank gaps, jump/anchor drift and target browser/device results.
- Define acceptance tolerances/config and decision report.

## Non-goals

No production Markdown pipeline, final TOC/settings, full styling or search/browser-find promise.

## Expected files

Spike route/harness, deterministic chunk generator, measurement helpers/tests, `docs/benchmarks/virtual-reader-spike.md`.

## Implementation notes

Use stable IDs, dynamic `measureElement` and actual document scroll unless evidence rejects DEC-015. Do not hide gaps with animation. `directDomUpdates` is mount-time and has DOM ownership requirements; do not toggle casually.

## UI and states

Diagnostic controls may trigger far jump/theme/resize/image load. Include visible focus target and basic continuous placeholders; do not claim final design.

## Edge cases

Huge first/last chunk, zero/incorrect estimate, image above viewport, sticky toolbar margin, focused link near eviction, 320 px table/code, iPhone address bar.

## Acceptance criteria

- [ ] First/middle/last markers reachable in correct order without sustained gaps.
- [ ] DOM/cache remain bounded by recorded values.
- [ ] Far jump and remeasurement preserve target within defined tolerance.
- [ ] Focus never silently disappears on range change.
- [ ] Automated target browsers and physical iPhone scenario have recorded results.
- [ ] Selected implementation/fallback and exact config are justified in decision report.

## Required tests

Harness component tests, deterministic Playwright scroll/jump/resize/image checks, benchmark script and physical iPhone checklist.

## Verification

Run `pnpm typecheck`, `pnpm lint`, targeted tests, `pnpm test:bench`, `pnpm test:e2e:all`, `pnpm build`; record physical-device steps separately.

## Completion report

State selected adapter/config/fallback, budgets/tolerances, browser/device evidence, changed files, commands, failed cases and whether P01-T04/P03-T02 are unblocked.
