# P02-T02 Complete import and Library UI

## Outcome

L-01 and O-01 implement the approved responsive/editorial states for picker/drop, honest progress, cancellation, actionable errors, success and stable Library metadata/focus.

## Why now

Pipeline and UI can mature independently behind the protocol; this task makes the core import usable without adding lifecycle decisions yet.

## Read before starting

`AGENTS.md`; `codex-spec/features/import-and-library.md`; `codex-spec/design/screens-and-user-flows.md` L-01/O-01; `codex-spec/design/ui-design-system.md`; P00-T06 report.

## Related requirements

PRD-002–003, UX-001, UX-003, UX-005–007, NFR-005, NFR-009.

## Preconditions

P01-T03 and P00-T06 complete. Dependencies: P01-T03, P00-T06.

## Scope

- Complete exhaustive ImportController reducer and responsive one-overlay flow.
- Implement FileTrigger/DropZone equivalence, stage/progress/cancel/finalize/success/error UI and Russian mappings.
- Complete Library header/intro/list/item/progress/loading/empty/metadata/storage-error shells and stable sort/focus.
- Implement responsive Dialog/Sheet, long content, 320 px, live announcements and cancel/Escape policies.
- Add recovery actions and optional safe diagnostics copy without content.

## Non-goals

No O-02 decisions (hook state only), delete flow, storage health implementation, final theme polish, auto-open or search.

## Expected files

Library/import feature components/controllers/styles/strings, UI primitive adaptations if justified, component/E2E tests.

## Implementation notes

One state machine/overlay owns transitions. Do not nest dialog for future decisions. Do not show fake percentage or remove Document optimistically. Main thread never holds source text/AST.

## UI and states

Every L-01/O-01 applicable state in `codex-spec/design/screens-and-user-flows.md`, including drag-over, multiple/invalid/UTF-8/too-large/quota/worker/cancel/success. Storage banner can use injected placeholder state until P05-T03.

## Edge cases

Long duplicate titles, same timestamps, file picker cancellation, late worker event, Escape during running/finalizing, mobile address bar/safe area, screen-reader milestone spam.

## Acceptance criteria

- [ ] Picker/drop/cancel/retry/success paths are keyboard/touch equivalent.
- [ ] State reducer rejects stale/impossible transitions and focus remains deterministic.
- [ ] Library empty/loading/ready/error and progress semantics match spec at 320/desktop.
- [ ] Actionable failures are inline with next step; success stays in Library and focuses result/new item.
- [ ] Axe/component/import E2E pass for required states.

## Required tests

Reducer transition table, component focus/live-region/axe/responsive tests, Chromium import/cancel/errors E2E and WebKit mobile flow.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, relevant WebKit suite, `pnpm build`; manual 320/keyboard check.

## Completion report

List implemented states/components/copy, files, commands, a11y/responsive evidence, deviations and O-02 integration hook.
