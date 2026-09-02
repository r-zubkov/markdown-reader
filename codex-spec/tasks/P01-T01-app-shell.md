# P01-T01 App shell and routes

## Outcome

The app has production route composition for Library/Reader/not-found, global providers/status region, Russian string boundary and theme bootstrap foundation without feature logic.

## Why now

Walking-skeleton features need stable entry points, error/focus behavior and tested UI primitives before integration.

## Read before starting

`AGENTS.md`; `codex-spec/architecture/system-architecture.md` routes/tree; `codex-spec/design/ui-design-system.md`; `codex-spec/design/screens-and-user-flows.md` catalog/G-01/E-01; P00-T06 report.

## Related requirements

TECH-001, TECH-013, TECH-014, UX-005–007, NFR-009, DEC-020.

## Preconditions

P00-T01 and P00-T06 complete. Dependencies: P00-T01, P00-T06.

## Scope

- Configure React Router 8 Declarative routes `/`, `/documents/:documentId`, `*` with lazy boundaries if justified.
- Create composition root/providers, skip link, AppHeader/ReaderToolbar shell slots, route error state and GlobalStatusRegion placeholders/contracts.
- Establish Russian string catalog/domain-code mapping boundary and `Intl` helpers.
- Implement pre-paint theme hint/provider skeleton and semantic token layers; full visual QA later.
- Add route focus policy and basic responsive shell/landmarks.

## Non-goals

No DB queries, import, full Reader/TOC, final themes, PWA service worker or storage banners.

## Expected files

`src/app`, router/providers/errors, shared strings/formatting, theme bootstrap/provider, shell components/styles and tests.

## Implementation notes

Use links for navigation. Reader missing Document is supplied later via loader/use case state, not Router data APIs. Keep router Declarative; do not introduce framework loaders/actions.

## UI and states

Library/Reader placeholders have correct heading/landmarks; not-found has Library link; theme choice applies without route remount.

## Edge cases

Direct unknown URL, invalid/empty `documentId`, hash present, 320 px title, route error, system theme changes, corrupt theme mirror.

## Acceptance criteria

- [ ] Routes/deep links render correct shell and `*` recovery.
- [ ] One main/skip link/named landmarks and route focus behavior are tested.
- [ ] String/Intl and theme boundaries do not leak domain messages/raw tokens into screens.
- [ ] Shell works at 320 and desktop without duplicate headers.

## Required tests

Router navigation/direct-entry/not-found, focus/landmark/axe, theme bootstrap/provider unit/component, long Russian string layout smoke.

## Verification

Run `pnpm typecheck`, `pnpm lint`, targeted tests, `pnpm test`, `pnpm build` and a manual route/320/theme smoke.

## Completion report

List routes/providers/contracts/files, tests/commands, actual deviations from spike, residual UI risks and next tasks.
