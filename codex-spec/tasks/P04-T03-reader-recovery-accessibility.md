# P04-T03 Reader recovery and accessibility hardening

## Outcome

Reader/Library lifecycle implements all specified missing/stale/partial/fatal/reprocess states and completes keyboard/focus/live-region behavior across routes, overlays, virtual content and pager.

## Why now

Core and lifecycle flows are complete; hardening them together prevents fragmented error/focus policies before platform styling/release QA.

## Read before starting

`AGENTS.md`; `codex-spec/design/screens-and-user-flows.md` all recovery states; `codex-spec/design/ui-design-system.md` accessibility; `codex-spec/testing-and-quality.md` accessibility; F01/F03/F04/F05 relevant states.

## Related requirements

UX-006–008, NFR-005, NFR-007, PRD-010–011.

## Preconditions

P03-T04, P04-T01/T02 complete. Dependencies: P03-T04, P04-T01, P04-T02.

## Scope

- Implement missing Document, empty document, no headings, stale/reprocessing, corrupt/partial chunk, anchor fallback and fatal route states.
- Complete route focus, skip links, overlay return after state replacement/delete, virtual focused-element policy, pager/TOC semantics and deduplicated announcements.
- Add safe diagnostics code/copy and retry/reimport/library recovery actions.
- Run targeted zoom/reflow/keyboard/axe/NVDA-or-equivalent and VoiceOver preparation tests; record manual gaps.

## Non-goals

No final color/theme visual audit, PWA/storage statuses, new features or broad redesign.

## Expected files

Reader/library error/reprocess components, focus/live-region utilities/adapters, strings and tests/manual accessibility record.

## Implementation notes

Expected errors remain typed states, not thrown into boundary. Partial fallback must not weaken sanitizer/provenance. Do not auto-focus banners or announce scroll progress.

## UI and states

All applicable R-01/L-01/E-01 recovery states, exact/approx notices, unavailable controls, safe retry/reimport, error boundary.

## Edge cases

Error while focus inside soon-unmounted chunk, route error after Sheet, retry changes DOM, missing source vs derived, repeated offline media error, last Document deletion then browser Back.

## Acceptance criteria

- [ ] Every specified Reader/route recoverable/fatal state has safe action and no raw stack/content leak.
- [ ] Partial/stale failures preserve readable safe content or intentionally block with reprocess; no unsafe HTML path.
- [ ] Full keyboard core flow/focus return works; virtual unmount never loses focus.
- [ ] Live announcements are useful/deduplicated; axe has no critical/serious issue in covered states.
- [ ] Zoom/reflow and initial screen-reader checks are recorded with remaining P05 audit items.

## Required tests

State/error component integration, focus/route/virtual/overlay tests, axe, E2E missing/stale/partial/retry/back and manual keyboard/screen-reader checklist.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e:all`, `pnpm build`; complete documented manual keyboard/zoom/screen-reader subset.

## Completion report

List states/recovery/focus evidence, files, commands/manual checks, unresolved P05 accessibility/visual issues and blockers.
