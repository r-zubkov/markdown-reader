# P03-T03 Sections, strategies and auto mode

## Outcome

Reader supports sections mode with pager/counter and all split strategies, applies evidence-based initial auto mode and explains unavailable `whole` without losing content.

## Why now

Sections can be built alongside continuous mode on shared outline/layout contracts and is the required safe fallback for large documents.

## Read before starting

`AGENTS.md`; `codex-spec/features/sections-toc-progress.md` sections/initial mode; `codex-spec/design/screens-and-user-flows.md` R-01/O-04; `codex-spec/architecture/data-and-state.md` layouts/ReaderState; P00-T05 report.

## Related requirements

PRD-007–010, TECH-007, UX-002, UX-006–008.

## Preconditions

P03-T01 and P00-T05 complete. Dependencies: P03-T01, P00-T05.

## Scope

- Render current SectionRef through bounded chunk access and implement accessible SectionPager/context.
- Implement ReadingSettings mode/strategy RadioGroups with immediate applying/rollback shell.
- Apply `auto/h1/h2/whole` layout metadata; continuous-mode strategy copy/ownership correct.
- Implement initial measured mode with `modeOrigin`, user override persistence hook and unavailable `whole` reason/recommendation.
- Complete table/code/media states shared with reader where not handled P03-T02.

## Non-goals

No final location persistence/mapping integration (P03-T04), replace mapping, typography controls or sticky bottom pager.

## Expected files

Sections reader/pager/settings/layout use cases/components/strings/styles and tests.

## Implementation notes

Do not recompute layouts in UI. One-section `whole` still queries bounded chunks. `h1/h2` without headings follows precomputed fallback. During apply capture/restore port is invoked even if temporary stub until P03-T04.

## UI and states

Sections ready, first/middle/last pager, one section, applying/error rollback, option unavailable, no headings, empty section, mobile Sheet/desktop Popover.

## Edge cases

No H1/H2, repeated titles, huge section/node, strategy chosen while continuous, user mode on replaced larger document, rapid changes, long destination title.

## Acceptance criteria

- [ ] Pager traverses every section exactly once and all layouts cover all chunks.
- [ ] `whole` never bypasses internal bounded access and unavailable reason is visible/accessibly associated.
- [ ] Initial auto/user override and modeOrigin are deterministic/persistable.
- [ ] Settings work keyboard/mobile and failure restores previous value.
- [ ] Section context/counter/title semantics and 320 px layout match spec.

## Required tests

Layout coverage/property regression, pager/settings components, modeOrigin state tests, E2E all strategies/first-last/mobile, axe/keyboard.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, relevant WebKit, `pnpm build`; manual all-strategy/320 check.

## Completion report

List strategy/auto behavior, layout coverage evidence, files, commands, deferred P03-T04 integration and risks.
