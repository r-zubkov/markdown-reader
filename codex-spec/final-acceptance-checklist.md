# Final acceptance checklist

Заполняется фактическими ссылками на тесты/reports/build. Не отмечать пункт по плану или визуальному впечатлению.

## MVP coverage

- [ ] Один UTF-8 `.md` импортируется атомарно; invalid/multiple/too-large/cancel/quota/crash не публикуют partial Document.
- [ ] Library переживает reload, показывает correct title/progress/stable activity order и управляет import/open/replace/delete.
- [ ] CommonMark/GFM corpus, footnotes, tables, task lists and code render safely; raw HTML inert.
- [ ] Whole-document H1–H3 TOC reaches correct content in both modes.
- [ ] Continuous bounded reader reaches entire large corpus without load-more/content loss.
- [ ] Sections/pager and `auto/h1/h2/whole` cover entire document; `whole` retains internal chunks.
- [ ] Initial auto mode, user mode/strategy preferences and per-document persistence behave deterministically.
- [ ] Reload/mode/strategy/replace restore exact or visible defined fallback.
- [ ] Exact duplicate, replace/separate/cancel and confirmed delete pass success/failure paths.
- [ ] Search/edit/sync/backend/other non-goals have not leaked into MVP.

## Data and recovery

- [ ] Schema/migrations, protocol and pipeline versions are independent and tested.
- [ ] Every visible Document references complete current ready version; invalid batches/commit conflicts are rejected.
- [ ] Raw Blob rebuild works; stale/partial/corrupt derived data has defined recovery.
- [ ] Old ready version survives failed/cancelled replace; cleanup is post-commit/idempotent.
- [ ] Delete removes exact related records only after success; failure keeps item/data.
- [ ] Storage risk/quota/persistence denial copy is honest; no automatic clear/delete.

## Security and privacy

- [ ] Security corpus proves no executable tags/events/styles, unsafe protocols or clobbering IDs.
- [ ] `dangerouslySetInnerHTML` exists only in `SafeHtmlChunk`; repository provenance/pipeline check is tested.
- [ ] CSP/host headers align with actual bundle, worker and approved image policy; no `unsafe-eval`.
- [ ] Document content and diagnostics are not uploaded/logged; network allowlist test passes.
- [ ] Remote images off/offline makes no third-party request; on allows only approved HTTPS/safe raster data behavior.
- [ ] No secret/token or content telemetry dependency exists.

## UI consistency and states

- [ ] Library, Reader and O-01–O-04/G-01 match action hierarchy, semantic tokens and technical-editorial direction.
- [ ] Light/dark/system covers reader/code/table/overlays/status/focus and starts without wrong-theme flash.
- [ ] Loading, empty, partial, success, recoverable/fatal error, offline, disabled and approximate states are implemented where specified.
- [ ] Errors say what happened, what stayed safe and next action; actionable errors are not toast-only.
- [ ] Long Russian title/filename/code/table and duplicate titles do not break layout.

## Responsive and accessibility

- [ ] 320, 390, 768, 1024, 1120 and 1440 widths plus landscape mobile pass with no page overflow/lost actions.
- [ ] Desktop persistent TOC and narrow Sheet/settings/import transitions follow breakpoints; `dvh`/safe areas work.
- [ ] Touch targets/focus ring/contrast/reduced motion/forced colors pass documented checks.
- [ ] Keyboard-only import/read/TOC/settings/pager/replace/delete succeeds with deterministic focus.
- [ ] NVDA and VoiceOver checks pass; live regions do not spam; virtualizer never loses focused element.
- [ ] 200%/400% zoom, reflow and text-spacing overrides preserve content/actions.
- [ ] Automated axe has no critical/serious unresolved violation on required states.

## Performance and compatibility

- [ ] F00 reports record corpus, environment, methods, accepted thresholds and fallbacks.
- [ ] File/node/chunk/DOM/cache/overscan/anchor limits in code match measured decisions and boundary fixtures.
- [ ] Import heavy work stays in worker; main-thread/scroll/DOM budgets pass large/pathological corpus.
- [ ] Continuous reader has no sustained blank gaps/jumps and passes far jump/image/font/theme remeasure.
- [ ] Chromium/Firefox/WebKit all-browser E2E and physical iPhone Safari checklist pass.
- [ ] Browser support statement respects Tailwind hard floor and records exact release versions.

## PWA/build/quality

- [ ] Production build launches after first visit offline and reads ready Document from IndexedDB.
- [ ] Cache Storage contains app shell only; Document source/chunks are not duplicated there.
- [ ] Update prompt is user-triggered, blocked during active import, flushes progress and has no reload loop.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:security`, `pnpm test:e2e:all`, `pnpm build` pass.
- [ ] Required performance benchmarks and manual smoke are attached/current.
- [ ] No known blocking content-loss, XSS, data-integrity, accessibility, offline or reader defect remains.
- [ ] Any waiver is explicit, approved, linked to requirement/risk and has owner/expiry; no silent skipped gate.

## Blueprint reconciliation

- [ ] CON-001–CON-005 resolutions are reflected in code and tests.
- [ ] Every MVP requirement in `codex-spec/requirements-and-decisions.md` maps to completed task and evidence.
- [ ] Terms/routes/enums/IDs match `codex-spec/project-source-of-truth.md` and `codex-spec/architecture/data-and-state.md` across UI/code/docs.
- [ ] `OPEN-001` brand placeholder is either resolved or remains isolated to tokens/strings without blocking release.
- [ ] Post-MVP ideas remain deferred and do not create unstable schema/UI promises.

Final decision: `ACCEPTED / REJECTED`. Record date, build/commit, reviewer and unresolved approved waivers.
