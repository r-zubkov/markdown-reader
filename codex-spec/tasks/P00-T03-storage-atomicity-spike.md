# P00-T03 IndexedDB atomicity spike

## Outcome

Minimal Dexie prototype and reusable integration tests prove staging/commit/abort/cleanup/migration/current-version preconditions without exposing partial Documents.

## Why now

The walking skeleton must be built on a transaction model already tested under interruption and replacement conflicts.

## Read before starting

`AGENTS.md`; `codex-spec/features/risk-spikes.md` Spike B; `codex-spec/architecture/data-and-state.md`; `codex-spec/architecture/system-architecture.md` import flow/errors.

## Related requirements

TECH-008–010, NFR-002, NFR-007; DEC-005, DEC-010.

## Preconditions

P00-T01 complete. Dependencies: P00-T01.

## Scope

- Prototype Dexie stores/indexes and repository transaction boundaries from `codex-spec/architecture/data-and-state.md`.
- Exercise new import and replace with expected-current precondition.
- Inject cancel/crash/reload between batches, duplicate/missing/out-of-order batches, quota-like failure, cleanup retry and migration/rebuild fixture.
- Verify library visibility query uses only valid current ready records.
- Save schema/atomicity report and reusable tests; identify any Dexie/browser differences needing production handling.

## Non-goals

No final domain models/UI, real Markdown worker, performance tuning of huge values beyond evidence needed for transaction choice, or cloud/Dexie Cloud.

## Expected files

Storage spike/repository prototype, fake-indexeddb tests, browser confirmation test, schema fixtures/report.

## Implementation notes

Avoid one long transaction spanning worker compute. Stage batches in short transactions; commit is short validation/pointer transaction. Simulated quota must not be the only browser evidence. Cleanup always scopes staging IDs/job IDs and never uses broad clear.

## UI and states

No product UI. Surface stable result/error codes consumed later.

## Edge cases

Document absent/new, stale current pointer, old ready cleanup fails, staging shares job incorrectly, source Blob present/derived corrupt, schema upgrade interrupted, multiple tabs/stale coordinator.

## Acceptance criteria

- [ ] Visible Document always points to complete ready version.
- [ ] Every pre-commit failure preserves previous ready version and hides staging.
- [ ] Commit rejects missing/duplicate/invalid ranges and stale current precondition.
- [ ] Cleanup is idempotent/scoped; raw Blob recovery path survives migration fixture.
- [ ] Findings update the target repository/schema contract without silent data deletion.

## Required tests

fake-indexeddb repository integration, migration fixtures, forced failure hooks and at least one real-browser IndexedDB confirmation.

## Verification

Run `pnpm typecheck`, `pnpm lint`, targeted storage tests, `pnpm test`, relevant browser test, `pnpm build`.

## Completion report

List schema/index/transaction decisions, failure matrix results, changed files, commands, deviations/risks and whether P01-T02 is unblocked.
