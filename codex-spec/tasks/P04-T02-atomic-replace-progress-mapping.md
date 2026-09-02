# P04-T02 Atomic replace and cross-version mapping

## Outcome

Replace/Separate flows fully stage and atomically switch versions with expected-current conflict protection, mapped ReaderState confidence and safe post-commit cleanup.

## Why now

Import decisions and stable semantic progress are both implemented, so replacement can preserve the user’s document identity/location honestly.

## Read before starting

`AGENTS.md`; `codex-spec/features/document-lifecycle.md`; `codex-spec/architecture/data-and-state.md` replace/mapping; P00-T05 report; `codex-spec/design/screens-and-user-flows.md` replace flow.

## Related requirements

PRD-013, TECH-009–010, NFR-002, NFR-007, UX-004/006.

## Preconditions

P02-T03 and P03-T04 complete. Dependencies: P02-T03, P03-T04.

## Scope

- Implement production replace use case with captured `expectedCurrentVersionId`.
- Stage complete new version, apply validated cross-version mapping and atomic Document/current/ReaderState switch.
- Preserve user mode/strategy/modeOrigin when valid; return exact/approximate/none reasons.
- Implement idempotent old-version cleanup after success, conflict/retry behavior and Separate completion if previously gated.
- Integrate O-02 progress/result copy and Reader one-time mapping notice.

## Non-goals

No version-history UI/rollback after success, content diff, annotation migration or fuzzy identity.

## Expected files

Replace use case/repository transaction/cleanup, mapping adapter/result UI/strings and integration/E2E tests.

## Implementation notes

Old ready source/chunks remain until commit. Cleanup failure is diagnostic/retry, not rollback of successful current pointer. Never persist old version-specific blockId unchanged. Commit conflict requires refreshed review.

## UI and states

Replacing, exact/approximate/none success, quota/worker/commit conflict/error/cancel. Approximate/none explained before Open and inside Reader once.

## Edge cases

Target changed/deleted in other tab, title changes, new Document shorter/empty, all headings changed, cleanup failure, exact duplicate discovered via explicit replace, old pipeline version.

## Acceptance criteria

- [ ] Any pre-commit failure/cancel/conflict preserves old current version/ReaderState.
- [ ] Successful replace keeps `documentId`, switches once and stores correct new current/mapped state.
- [ ] Confidence labels match mapping tests and visible notices.
- [ ] Old data cleanup occurs only after commit and is idempotent.
- [ ] Separate produces independent Document; explicit exact duplicate does not replace unnecessarily.

## Required tests

Repository conflict/atomicity/cleanup integration; mapping update-pair regression; O-02 result component; E2E exact/approx/none/failure/cancel/conflict/separate.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e:all`, `pnpm build`; verify DB current/old records in assertions.

## Completion report

Report atomic/mapping/cleanup behavior, files, commands, confidence corpus results, conflicts/deviations and residual data risks.
