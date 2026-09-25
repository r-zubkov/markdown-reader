# Final acceptance checklist

Fill this with actual links to tests/reports/builds. Do not check an item based on a plan or visual impression.

## MVP coverage

- [x] One UTF-8 `.md` imports atomically; invalid/multiple/too-large/cancel/quota/crash paths do not publish a partial Document.
- [x] Library survives reload, shows correct title/progress/stable activity order and supports import/open/replace/delete.
- [x] CommonMark/GFM corpus, footnotes, tables, task lists and code render safely; raw HTML is inert.
- [x] Whole-document H1–H3 TOC reaches correct content in both modes.
- [x] Continuous bounded reader reaches the entire large corpus without load-more/content loss.
- [x] Sections/pager and `auto/h1/h2/h3/whole` cover the entire document; `whole` retains internal chunks.
- [x] Initial auto mode, user mode/strategy preferences and per-document persistence behave deterministically.
- [x] Reload/mode/strategy/replace restore exact or visible defined fallback.
- [x] Exact duplicate, replace/separate/cancel and confirmed delete pass success/failure paths.
- [x] Search/edit/sync/backend/other non-goals have not leaked into MVP.

Evidence: the 147-test unit/integration suite and 41-test Chromium suite cover import, Library, pipeline, TOC, both Reader modes, progress and lifecycle. See [the release-candidate record](../docs/release-candidate-2026-09-25.md), [production pipeline evidence](../docs/benchmarks/production-pipeline.md), [continuous Reader evidence](../docs/benchmarks/continuous-reader.md) and [progress persistence evidence](../docs/benchmarks/progress-persistence.md).

## Data and recovery

- [x] Schema/migrations, protocol and pipeline versions are independent and tested.
- [x] Every visible Document references a complete current ready version; invalid batches/commit conflicts are rejected.
- [x] Raw Blob rebuild works; stale/partial/corrupt derived data has defined recovery.
- [x] Old ready version survives failed/cancelled replace; cleanup is post-commit/idempotent.
- [x] Delete removes exact related records only after success; failure keeps item/data.
- [x] Storage risk/quota/persistence denial copy is honest; there is no automatic clear/delete.

Evidence: [storage atomicity](../docs/benchmarks/storage-atomicity-spike.md), [storage health](../docs/benchmarks/storage-health.md), repository integration tests and the release Chromium cases for real IndexedDB Blob recovery, replacement conflicts, delete failure and source rebuild.

## Security and privacy

- [x] Security corpus proves no executable tags/events/styles, unsafe protocols or clobbering IDs.
- [x] `dangerouslySetInnerHTML` exists only in `SafeHtmlChunk`; repository provenance/pipeline checks are tested.
- [x] CSP/host headers align with the actual bundle, Worker and approved image policy; there is no `unsafe-eval`.
- [x] Document content and diagnostics are not uploaded/logged; the network allowlist test passes.
- [x] Remote images off/offline makes no third-party request; on allows only approved HTTPS/safe raster data behavior.
- [x] No secret/token or content telemetry dependency exists.

Evidence: 12 security tests, production CSP PWA coverage, the persisted-HTML corruption browser test and the source/network audit recorded in [P05-T04 hardening evidence](../docs/accessibility/P05-T04-hardening.md).

## UI consistency and states

- [x] Library, Reader and O-01–O-04/G-01 match action hierarchy, semantic tokens and technical-editorial direction.
- [x] Light/dark/system covers Reader/code/table/overlays/status/focus and starts without a wrong-theme flash.
- [x] Loading, empty, partial, success, recoverable/fatal error, offline, disabled and approximate states are implemented where specified.
- [x] Errors say what happened, what stayed safe and the next action; actionable errors are not toast-only.
- [x] Long Russian-locale title/filename/code/table content and duplicate titles do not break layout.

Evidence: component state-machine tests, the full Chromium suite and the two-theme visual/axe record in [P05-T01 evidence](../docs/accessibility/P05-T01-theme-responsive.md).

## Responsive and accessibility

- [x] 320, 390, 768, 1024, 1120 and 1440 widths plus landscape mobile-Chromium pass with no page overflow/lost actions.
- [x] Desktop persistent TOC and narrow Sheet/settings/import transitions follow breakpoints; `dvh`/safe-area behavior is covered.
- [x] Touch targets/focus ring/contrast/reduced motion/forced colors pass documented checks.
- [x] Keyboard-only import/read/TOC/settings/pager/replace/delete succeeds with deterministic focus.
- [x] Live regions remain bounded and the virtualizer retains focused content. NVDA + Chrome is an explicit user-approved waiver; VoiceOver/Safari/iOS is outside the DEC-022 MVP matrix, so no screen-reader compatibility claim is made.
- [x] Equivalent 200%/400% CSS-pixel reflow and text-spacing overrides preserve content/actions. Direct Chrome UI zoom is an explicit user-approved waiver.
- [x] Automated axe has no critical/serious unresolved violation on required states.

Evidence and waiver scope: [P05-T04 hardening evidence](../docs/accessibility/P05-T04-hardening.md). The waiver owner is the release maintainer and it expires before any screen-reader/browser-zoom compatibility claim or material accessibility layout redesign.

## Performance and compatibility

- [x] F00 reports record corpus, environment, methods, accepted thresholds and fallbacks.
- [x] File/node/chunk/DOM/cache/overscan/anchor limits in code match measured decisions and boundary fixtures.
- [x] Import heavy work stays in the Worker; main-thread/scroll/DOM budgets pass the large/pathological corpus.
- [x] Continuous Reader has no sustained blank gaps/jumps and passes far jump/image/font/theme remeasurement.
- [x] Chromium E2E and responsive mobile-Chromium checklist pass.
- [x] Browser support statement respects the Tailwind hard floor and records exact release versions.

Evidence: [pipeline](../docs/benchmarks/production-pipeline.md), [virtual Reader](../docs/benchmarks/virtual-reader-spike.md), [production Reader](../docs/benchmarks/continuous-reader.md), [mapping](../docs/benchmarks/progress-mapping-spike.md), [mobile platform](../docs/benchmarks/mobile-ui-platform-spike.md) and the current measurements in [the release record](../docs/release-candidate-2026-09-25.md).

## PWA/build/quality

- [x] Production build launches after the first visit offline and reads a ready Document from IndexedDB.
- [x] Cache Storage contains app shell only; Document source/chunks are not duplicated there.
- [x] Update prompt is user-triggered, blocked during active import, flushes progress and has no reload loop.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:security`, `pnpm test:bench`, `pnpm test:e2e:all` and `pnpm build` pass.
- [x] Required performance benchmarks and release smoke are attached/current.
- [x] No known blocking content-loss, XSS, data-integrity, accessibility, offline or Reader defect remains.
- [x] Every waiver is explicit, approved, linked to the requirement/risk and has an owner/expiry condition; there is no silent skipped gate.

Evidence: [release-candidate commands and smoke](../docs/release-candidate-2026-09-25.md), [PWA hosting contract](deployment/pwa-hosting.md) and [P05-T04 hardening evidence](../docs/accessibility/P05-T04-hardening.md).

## Blueprint reconciliation

- [x] CON-001–CON-005 resolutions are reflected in code and tests.
- [x] Every MVP requirement in `codex-spec/requirements-and-decisions.md` maps to a completed task and evidence.
- [x] Terms/routes/enums/IDs match `codex-spec/project-source-of-truth.md` and `codex-spec/architecture/data-and-state.md` across UI/code/docs.
- [x] `OPEN-001` remains an isolated neutral-blue token/string placeholder and does not block release.
- [x] Post-MVP ideas remain deferred and do not create unstable schema/UI promises.

Evidence: the 52 normalized MVP requirements map through the traceability table to 25 completed tasks. A local-link audit checked all 61 repository Markdown files with no missing target.

Final decision: `ACCEPTED` on 2026-09-25. Code revision: `7bab8e699390eb970ae78fe9b3638e0ff6fd41d3`; reviewer: Codex release audit. Approved waivers: NVDA + Chrome and direct Chrome UI 200%/400% zoom, approved by the user on 2026-09-24 and scoped in [the release record](../docs/release-candidate-2026-09-25.md).
