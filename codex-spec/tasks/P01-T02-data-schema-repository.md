# P01-T02 Data schema and repository foundation

## Outcome

Production Dexie schema, validated persisted contracts and repository ports implement stage/batch/commit/abort/query/cleanup with migrations based on the atomicity spike.

## Why now

The walking import must cross the real persistence boundary rather than an in-memory temporary model.

## Read before starting

`AGENTS.md`; `codex-spec/architecture/data-and-state.md`; `codex-spec/architecture/system-architecture.md` repository/errors; P00-T03 report; `codex-spec/features/import-and-library.md` interfaces.

## Related requirements

TECH-002, TECH-008–010, TECH-012, NFR-002, NFR-007, DEC-020.

## Preconditions

P00-T03 complete. Dependencies: P00-T03.

## Scope

- Implement schema/version 1, runtime record validation and domain↔persisted mapping.
- Implement repository ports for staging, ordered batches, atomic new-document commit, abort, current Document summaries, reader window/state baseline and abandoned cleanup.
- Enforce ready/current/count/range/job/pipeline invariants from spike.
- Add migration fixture framework and app-start DB initialization/recovery result.
- Add narrow live-query adapter for Library metadata without exposing tables.

## Non-goals

No production pipeline, replace/delete complete lifecycle, search index, cloud sync, UI or broad generic repository.

## Expected files

`src/infrastructure/db`, application repository ports, domain/persisted schemas/validators, test fixtures/integration tests, composition wiring.

## Implementation notes

Repository is only Dexie boundary. Use exact IDs and current-version preconditions. Rebrand HTML only after current pipeline validation; walking skeleton may store test-safe HTML through an explicit test pipeline path, never an unchecked cast.

## UI and states

Expose typed `DB_UNAVAILABLE`, `MIGRATION_FAILED`, `STALE_DERIVED`, `QUOTA_EXCEEDED` results; no copy here.

## Edge cases

Empty DB, invalid persisted enum/ratio, incomplete staging, duplicated ordinal, missing source, old schema fixture, failed cleanup, live query during commit.

## Acceptance criteria

- [ ] Repository tests reproduce P00 atomicity guarantees.
- [ ] UI-facing queries cannot see staging/inconsistent Document.
- [ ] Persisted records validate before domain use and stale HTML is not branded.
- [ ] Startup cleanup/migration failures preserve ready/source data and return recoverable state.
- [ ] No feature/screen imports Dexie table/schema directly.

## Required tests

fake-indexeddb integration for every port/invariant, migration fixture, live-query behavior, browser IndexedDB smoke and import-boundary lint.

## Verification

Run `pnpm typecheck`, `pnpm lint`, storage tests, `pnpm test`, relevant browser smoke, `pnpm build`.

## Completion report

List schema/index/ports, migrations/invariants, files, commands/results, spike deviations and unblocked tasks.
