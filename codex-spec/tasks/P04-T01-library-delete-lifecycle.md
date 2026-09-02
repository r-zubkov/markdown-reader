# P04-T01 Library management and delete

## Outcome

Library DocumentItem actions are complete and delete uses the specified safe AlertDialog, exact transactional repository deletion, non-optimistic errors and deterministic focus.

## Why now

The library can now manage real complete Documents; delete can land independently of cross-version replace mapping.

## Read before starting

`AGENTS.md`; `codex-spec/features/document-lifecycle.md` delete; `codex-spec/design/screens-and-user-flows.md` L-01/O-03; `codex-spec/architecture/data-and-state.md` delete lifecycle; `codex-spec/design/ui-design-system.md` destructive/focus.

## Related requirements

PRD-003, PRD-014, UX-001, UX-004, NFR-002.

## Preconditions

P02-T02 and P01-T02 complete. Dependencies: P02-T02, P01-T02.

## Scope

- Complete DocumentItem primary/overflow actions and accessible unique labels.
- Implement O-03 AlertDialog copy, safe initial focus, deleting/error/success states.
- Implement exact-ID transactional repository delete across states/versions/chunks/Document and live query update.
- Implement focus target after cancel/success and last-Document empty transition.
- Add failure/idempotent/stale-entry tests.

## Non-goals

No Undo/soft delete, bulk clear, version history, replace mapping or optimistic removal.

## Expected files

Library action/menu/DeleteDocumentFlow components/strings, repository delete use case/tests and E2E.

## Implementation notes

Do not delete by normalized title/hash. If another context already removed exact Document, refresh with idempotent result. No clear-all recovery action.

## UI and states

Menu focus return; confirm/deleting/inline error/success; next/previous/empty CTA focus. Long title accessible in full.

## Edge cases

Only Document, first/middle/last, repository fails after request, stale menu item, another tab/reader open, very long/duplicate title.

## Acceptance criteria

- [ ] Delete cannot occur from one menu activation and consequences are explicit.
- [ ] Successful transaction removes all exact Document-related records and then UI item.
- [ ] Failure keeps item/data and offers Retry/Cancel; no optimistic disappearance.
- [ ] Focus after cancel/success matches logical target including empty Library.
- [ ] Keyboard/axe/320 px checks pass.

## Required tests

Repository deletion/idempotency integration, component focus/error/axe, E2E cancel/success/failure/last Document.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`; inspect DB records in test assertion.

## Completion report

List deleted record scope/focus behavior, files, commands/results, edge failures and remaining lifecycle tasks.
