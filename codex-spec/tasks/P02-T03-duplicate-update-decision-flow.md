# P02-T03 Duplicate and update decision flow

## Outcome

Exact duplicate and possible-update detection transition the existing import overlay into explicit Open/Replace/Separate/Cancel decisions without committing incorrect data.

## Why now

Lifecycle choice must be integrated before full replace implementation and before duplicate Documents can enter the Library.

## Read before starting

`AGENTS.md`; `codex-spec/features/document-lifecycle.md` duplicate/update; `codex-spec/design/screens-and-user-flows.md` O-02; `codex-spec/architecture/data-and-state.md` normalization; `codex-spec/features/import-and-library.md` decision state.

## Related requirements

PRD-012, PRD-013, TECH-009, UX-004, NFR-002.

## Preconditions

P02-T01/T02 complete. Dependencies: P02-T01, P02-T02.

## Scope

- Implement exact ready-hash lookup and normalized title/filename candidate policy, including multiple candidates.
- Extend one ImportFlow reducer/UI for exact duplicate and possible-update summaries/actions.
- Exact duplicate aborts staging and opens existing/close.
- Separate continues with new `documentId`; Replace emits explicit target intent and can use a provisional safe integration path while full mapping/cleanup lands P04-T02.
- Preserve old ready data on all errors/cancel and test focus/state replacement.

## Non-goals

No content diff, version history, fuzzy matching, final cross-version mapping algorithm implementation or delete.

## Expected files

Domain identity/decision policy, repository queries/ports, ImportFlow O-02 components/strings and tests.

## Implementation notes

Similarity never auto-selects. Hash is not shown. If full Replace commit is intentionally deferred, the UI/action must not claim success; use established replace port/staging contract and keep incomplete branch visibly/testably gated until P04-T02.

## UI and states

Exact duplicate; single/multiple update candidates; replacing/adding separately handoff; cancel/error. Full action labels and accessible consequence descriptions.

## Edge cases

Same hash different filename, multiple exact Documents from legacy/corruption, explicit target already exact, candidate deleted/stale, Unicode normalization, late worker result.

## Acceptance criteria

- [ ] Exact duplicate cannot create a new Document and opens correct existing Document.
- [ ] One/multiple candidates require explicit user target/outcome; no silent replace.
- [ ] Separate creates independent identity through normal atomic commit.
- [ ] Error/cancel leaves old data and focus intact.
- [ ] O-01→O-02 remains one modal flow and passes keyboard/axe.

## Required tests

Identity/policy unit cases, repository query integration, reducer/component state replacement/focus, exact/separate/cancel E2E; replace handoff contract test.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`; manual multi-candidate/keyboard check.

## Completion report

Describe policies/outcomes, state flow, any deferred replace behavior, files, commands/results, risks and tasks unblocked.
