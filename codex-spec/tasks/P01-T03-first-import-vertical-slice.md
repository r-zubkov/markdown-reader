# P01-T03 First import vertical slice

## Outcome

A minimal real File → Worker → staging Dexie → atomic commit → Library row flow works for one safe fixture and leaves no partial Document on failure.

## Why now

This is the first walking skeleton proving the chosen module boundaries before full pipeline/UI complexity.

## Read before starting

`AGENTS.md`; `codex-spec/features/import-and-library.md`; `codex-spec/architecture/system-architecture.md` import flow/protocol; `codex-spec/architecture/data-and-state.md` atomicity; P00-T02/P00-T03 reports.

## Related requirements

PRD-001–003, TECH-003, TECH-008–009, NFR-002, DEC-020.

## Preconditions

P01-T01/T02, P00-T02 complete. Dependencies: P01-T01, P01-T02, P00-T02.

## Scope

- Define shared versioned worker protocol and minimal coordinator/controller port.
- Implement worker path for authoritative UTF-8/hash and a minimal approved safe paragraph/heading pipeline sufficient for walking fixture, reusing spike code where valid.
- Stage/append/commit into real repository and display minimal Library summary through live query.
- Provide minimal file button, running/success/error/cancel states; polished O-01 later.
- Add forced failure/cancel integration and reload persistence E2E.

## Non-goals

No complete GFM/highlight/layout strategies, duplicate/update, final Library design, drag/drop, PWA or continuous virtual reader.

## Expected files

Shared worker protocol, import worker/coordinator/controller, minimal Library feature components/wiring, tests and one walking fixture.

## Implementation notes

Do not create a parallel temporary storage/API that production tasks must discard. Clearly mark intentionally incomplete pipeline features through tests/task status, not permissive behavior. Late messages ignored after terminal job.

## UI and states

Minimal accessible file action, running stage, cancel, inline error, ready row. No fake percentage or optimistic Document.

## Edge cases

Invalid UTF-8, cancel before/after first batch, worker error, quota injection, reload with staging, empty title fallback.

## Acceptance criteria

- [ ] Valid fixture produces one ready Document visible in Library and survives reload.
- [ ] Worker/cancel/repository failure produces no visible partial Document.
- [ ] Main/worker protocol rejects stale/unknown job/version.
- [ ] Flow uses real repository/live query, not in-memory source of truth.
- [ ] Minimal controls are keyboard accessible.

## Required tests

Protocol/reducer unit; coordinator/repository integration; component states; Chromium E2E import/reload/cancel/failure.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`; manually reload walking Document.

## Completion report

Describe working vertical path, intentional missing production features, files, commands/results, deviations and next tasks.
