# P03-T04 progress persistence report

Date: 2026-09-14

## Accepted behavior

- The Reader observes the top meaningful rendered Markdown block at a 72 px semantic reading line. Pixel geometry is used only to produce a `SemanticAnchor`; the persisted source of truth remains `ReaderState` in IndexedDB.
- `ReaderLocationController` applies a 120 ms coalescing UI throttle and an 800 ms trailing persistence throttle. A 50-observation fake-clock profile produced one UI publication and one repository write.
- Pending state is flushed before TOC navigation, mode or strategy changes, route cleanup and `pagehide`. Writes are serialized and persistence failures produce an inline retry-relevant notice without replacing the last valid location.
- Progress derives from the observed block source range and clamped intra-block ratio. It reaches 100% only when the final meaningful block is at least 90% traversed, or the page end is reached while that final block is current.
- A valid URL hash has precedence over saved state. Same-version restore reuses the P00-T05 `mapSemanticAnchor` confidence/reason contract: an exact unique block match restores silently; approximate restore offers Continue and Start; no match offers Start.
- Continuous and sections presentations annotate only already-sanitized top-level nodes after the `SafeHtmlChunk` trust boundary. No raw document content enters React state, logs or network requests.
- Library progress is read from the same persisted `ReaderState` record and formatted through `Intl.NumberFormat`.

## Tolerance and browser evidence

- Exact same-version restoration has zero-block tolerance: the persisted block ID is the block targeted after reload.
- Active-heading observation may differ by at most one adjacent semantic boundary while the reading line straddles two blocks.
- Explicit hash positioning is asserted within 96 px of the 72 px reading line.
- The P03-T04 Chromium scenario covers scroll to automatic persistence, `pagehide` flush, Library summary, reload, continuous/sections and strategy restoration, and saved-anchor versus hash precedence.
- The complete Chromium suite passed 27 of 27 scenarios. The focused P03-T04 scenario also passed after the final assertions were added.

## Verification

- `node .corepack/v1/pnpm/11.25.0/bin/pnpm.cjs typecheck`
- `node .corepack/v1/pnpm/11.25.0/bin/pnpm.cjs lint`
- `node .corepack/v1/pnpm/11.25.0/bin/pnpm.cjs test` — 24 files, 109 tests
- `node .corepack/v1/pnpm/11.25.0/bin/pnpm.cjs test:security` — 3 tests
- `node .corepack/v1/pnpm/11.25.0/bin/pnpm.cjs test:bench` — 4 files, 6 tests
- `node .corepack/v1/pnpm/11.25.0/bin/pnpm.cjs build`
- Separately managed Vite plus `playwright test --project=chromium` — 27 passed

## Contract impact and reuse

No dependency, IndexedDB schema or Markdown pipeline version changed. `ReaderState.lastSectionId` is optional in the existing store, and rendered anchor metadata comes from already persisted pipeline-v4 records.

P04-T02 should reuse `ResolvedReaderAnchor`, `mapSemanticAnchor` and the existing exact/approximate/none reason matrix for cross-version replacement. It must not promote ratio-only recovery to exact or introduce a second mapper.

## Deviations and residual work

There is no task-scope deviation. Cross-version mapping and replacement cleanup remain P04-T02; broader Reader recovery and accessibility hardening remain P04-T03.
