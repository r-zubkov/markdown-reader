# F01. Import and local library

## User value

Add one local Markdown file once, see a trustworthy ready Document in the browser library, and return to it after reload. Related: PRD-001–003, UX-001, UX-003, TECH-003, TECH-008, TECH-009, NFR-002, NFR-007.

## Scope / non-goals

Scope: library metadata query/sort/states; FileTrigger/DropZone; worker coordination; honest progress/cancel; staging/commit; success/error; reprocess entry.

Non-goals: duplicate/update decision details (F05), search/filter, batch/folder import, cover generation, auto-open after success, export.

## Preconditions

Bootstrap, repository contract/schema and applicable F00 pipeline/storage/mobile gates exist. Final measured file limits may be configured; until then production import cannot claim release-ready.

## Primary flow

1. L-01 queries only Document/current metadata and ReaderState progress.
2. User opens O-01 and selects/drops one `.md`.
3. UI validation catches obvious multiplicity/extension; authoritative worker validates bytes/UTF-8/limits.
4. Controller receives stage/progress and maintains one active job.
5. Coordinator stages metadata/batches and finalizes only after Complete + repository validation.
6. Ready Document appears at library top; success offers Open/Done.
7. Reload reads same ready Document; staging is invisible.

## Business rules

- Exactly one active import per tab; a second entry focuses current flow.
- Extension comparison case-insensitive; MIME is not authoritative.
- Title first H1 plain text, else filename without `.md`.
- Progress percentage is displayed only when worker provides a meaningful ratio; otherwise stage + indeterminate.
- Cancel is a handshake and idempotent. Late worker messages for terminal job are ignored.
- Document is visible only when `documents.currentVersionId` references a validated ready version.
- Library sort uses last activity + `documentId`; item does not reorder under the initiating click.
- UI never reads chunks to render Library.

## UI/states

Use L-01/O-01 contracts in `codex-spec/design/screens-and-user-flows.md`. Required controller states:

```ts
type ImportUiState =
  | { status: 'idle' }
  | { status: 'validating'; file: FileSummary }
  | { status: 'running'; stage: ImportStage; ratio?: number; canCancel: boolean }
  | { status: 'decision'; context: ImportDecisionContext }
  | { status: 'cancelling' }
  | { status: 'finalizing' }
  | { status: 'succeeded'; documentId: DocumentId }
  | { status: 'failed'; error: ImportError; retry: RetryKind }
  | { status: 'cancelled' };
```

Reducer rejects impossible/stale job transitions. Error UI maps stable codes to Russian copy; optional diagnostics excludes source content.

## Interfaces

- `ImportDocumentUseCase.start(file, intent, sink): ImportHandle`
- `ImportHandle.cancel(): Promise<CancelResult>`
- `DocumentRepository.observeDocuments(): Observable/LiveQuery<DocumentSummary[]>`
- `DocumentRepository.stageVersion`, `appendChunkBatch`, `commitVersion`, `abortVersion`, `cleanupAbandonedStaging` per architecture.

Feature consumes interfaces; concrete Worker/Dexie remain infrastructure.

## Edge cases

- zero-byte valid UTF-8 file → ready empty Document with filename title and explicit empty-reader state, unless spike defines minimum-content rejection; decision must be recorded.
- multiple first H1/repeated H1 → first determines title, outline preserves all.
- worker crash after N batches, cancel during batch/finalize, tab reload, storage quota, duplicate batch/out-of-order batch.
- long Unicode filename/title, same activity timestamp, DB unavailable/private mode, document current version missing/corrupt.
- drag multiple files imports none; mobile touch always has file button.

## Performance/accessibility/security

Worker transfer/batches obey measured limits; no document text in React global state/log. Dialog/Sheet focus and stage announcements are throttled. `File` stays local. Library renders metadata only and uses skeleton, not whole-screen spinner.

## Acceptance criteria

- [ ] One valid fixture imports to one ready Document and survives reload.
- [ ] No cancellation/crash/quota path creates a visible partial Document or changes existing ready data.
- [ ] Picker and DropZone produce the same validated use case.
- [ ] Library title/progress/sort/empty/error states match screen spec at 320 px and desktop.
- [ ] Keyboard/screen-reader user can import, cancel, retry and open result with deterministic focus.
- [ ] Repository rejects incomplete/out-of-order commit.

## Required tests

Reducer transition unit tests; coordinator/repository integration with fake IDB; worker mock protocol tests; component focus/error tests; E2E empty → import → ready → reload; cancellation and quota/termination E2E/browser tests.

## Dependencies

F00 pipeline/storage/mobile, P01-T01/T02. F02 supplies production pipeline; F05 plugs decision state without nesting overlay.
