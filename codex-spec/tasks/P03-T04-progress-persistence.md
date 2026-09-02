# P03-T04 Semantic progress persistence

## Outcome

Reader observes, throttles and persists semantic location/progress and restores it across reload, TOC, continuous/sections and strategy changes with exact/approximate/none UI.

## Why now

Both reader presentations now exist; one controller can integrate them without competing sources of truth.

## Read before starting

`AGENTS.md`; `codex-spec/features/sections-toc-progress.md`; `codex-spec/architecture/data-and-state.md` progress/mapping; P00-T05 report; `codex-spec/design/screens-and-user-flows.md` restore/mode flow.

## Related requirements

PRD-008, PRD-011, TECH-012, UX-006–007, NFR-001.

## Preconditions

P03-T02/T03 and P00-T05 complete. Dependencies: P03-T02, P03-T03, P00-T05.

## Scope

- Implement imperative ReaderLocationController/top-visible meaningful block observation.
- Derive active heading/progress and trailing-throttled repository writes without render/write per scroll event.
- Flush on explicit TOC/mode/strategy/route leave/pagehide best effort.
- Implement same-version mapping/resolution and exact/approximate/none UI/announcements.
- Integrate Library progress summaries and mode/strategy persistence with correct ownership/modeOrigin.

## Non-goals

No cross-version replace mapping (reuse pure mapping later), per-scroll history, bookmarks or unload confirmation.

## Expected files

Location controller/observer/mapper integration, ReaderState repository methods, restore status components/strings and tests.

## Implementation notes

Use fake clock/observer tests. Pixel metrics are observation inputs, not persisted canonical location. Hash precedence remains P03-T01. Avoid announcing percentage. Define 100% policy via measured semantic rule.

## UI and states

Restoring skeleton/status, exact silent, approximate info with Continue/Start, none start notice, applying busy, persistence error rollback/notice where relevant.

## Edge cases

Pagehide before throttle, route during pending write, focused heading, empty/huge block, invalid old anchor, rapid mode toggles, DB error, hash vs saved anchor.

## Acceptance criteria

- [ ] Reload/TOC/mode/strategy restore passes measured tolerance or correct fallback notice.
- [ ] Scroll event rate does not equal React render/IDB write rate; tests prove throttle/flush.
- [ ] Library progress and ReaderState remain one source and survive reload.
- [ ] Hash precedence and modeOrigin/user choice remain correct.
- [ ] Announcements/focus do not spam/disappear during restore.

## Required tests

Controller fake-clock/observer, mapping corpus regression, repository persistence, restore state component, E2E scroll→reload/mode/strategy/hash/pagehide.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e:all`, `pnpm build`; profile scroll render/write counts against fixture.

## Completion report

Report throttle/flush/100% policy, tolerance results, UI states, files, commands/profile evidence, deviations and cross-version reuse point.
