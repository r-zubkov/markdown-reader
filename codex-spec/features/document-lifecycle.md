# F05. Duplicate, replace and delete lifecycle

## User value

Avoid identical copies, deliberately update a corrected document without losing current data, and remove a document without accidental irreversible loss. Related: PRD-012–014, TECH-009, NFR-002, UX-004.

## Scope / non-goals

Exact duplicate query/flow, similarity candidates, replace/separate/cancel, current-version precondition, cross-version progress mapping, post-commit cleanup and confirmed transactional delete.

Non-goals: visible version history, diff viewer, rollback after successful replace, Undo delete, merging annotations, bulk delete.

## Exact duplicate

After raw SHA-256 metadata is available, repository searches ready/current versions. If match:

- no new Document is committed;
- any staging for current job is aborted;
- UI names existing Document and offers Open/Close;
- filename difference does not change exact identity;
- multiple historical records with same hash resolve to current Documents; if more than one valid Document somehow exists, list choices rather than silently pick.

## Possible update

Candidate if hash differs and normalized filename or normalized title exactly matches. Similarity is suggestion, never automatic mutation.

- One candidate → show existing/selected summary and Replace/Separate/Cancel.
- Multiple candidates → require target selection or Separate/Cancel.
- Explicit «Заменить файлом» supplies target and skips similarity ambiguity, but still checks exact duplicate.
- Separate creates a new `documentId`, default ReaderState and independent progress.

## Replace transaction

1. Capture target `documentId`, `expectedCurrentVersionId` and ReaderState.
2. Stage full new version; old current remains ready/readable.
3. Run cross-version anchor mapping and return confidence/reason.
4. Atomic commit verifies current precondition, batch coverage and pipeline version, flips current pointer, writes mapped state/title/filename/updated time.
5. Publish success; post-commit cleanup removes old versions/chunks idempotently.

If another tab/version changed pointer, return `COMMIT_CONFLICT`; never overwrite newer state. Retry requires fresh target review.

## Mapping result

Preserve user reading mode/strategy and `modeOrigin` when valid. Anchor mapping uses F00/F04 algorithm. If `exact`, update versionId/block. If `approximate`, persist fallback and show notice before/inside Reader. If `none`, progress becomes start and notice is mandatory. Do not carry a raw old blockId as if valid.

## Delete

- Entry only from Document menu, O-03 exact title and consequence copy.
- No optimistic removal. Repository transaction deletes all document-related records; failure keeps item/current route intact.
- If delete invoked for a Document that becomes stale/missing, return idempotent/not-found result and refresh list; do not delete another Document by similarity.
- After success focus chooses next logical item/previous/empty CTA; no Undo is shown.

## Edge cases

Same bytes different name; same title many candidates; replacement title changes; candidate Document deleted while dialog open; exact duplicate of target current version through explicit replace; quota/worker failure; commit conflict; cleanup failure; delete while reader open in another tab; corrupted historical version; title normalization Unicode/case/whitespace.

## Security/reliability/accessibility

Never show hash as decision content; filenames/title are escaped text. All irreversible actions use full labels and focus rules. Cleanup scopes by exact IDs. Old ready data is never removed before successful pointer switch.

## Acceptance criteria

- [ ] Exact duplicate produces no second Document/current version and can open existing Document.
- [ ] Similarity never auto-replaces; all candidates/outcomes are explicit.
- [ ] Replace failure/cancel/quota/conflict leaves old ready version and ReaderState unchanged.
- [ ] Successful replace preserves `documentId`, switches exactly once and reports mapping confidence.
- [ ] Separate import produces independent Document/ReaderState.
- [ ] Delete requires confirmation, removes all exact related records on success and preserves UI/data on failure.
- [ ] Focus return after duplicate/update/delete matches screen contract.

## Required tests

Duplicate/update policy unit tests; normalized identity cases; repository commit conflict/cleanup/delete integration; mapping update corpus; O-02/O-03 focus/state component tests; E2E exact duplicate, replace exact/approx/none, separate, failure and delete.

## Dependencies

F01 state machine/repository, F02 hash/metadata, F04 mapping. Tasks P02-T03, P04-T01/T02.
