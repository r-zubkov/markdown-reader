# P00-T03 storage atomicity spike report

Task: `P00-T03 IndexedDB atomicity spike`.

## Environment

- OS/session: Windows workspace `E:\Github\markdown-reader`.
- Node: `v24.20.0`.
- Package manager: `pnpm@11.25.0` via Corepack with `COREPACK_HOME=.corepack`.
- Storage dependency: `dexie@4.4.5`; package metadata in `node_modules/dexie/package.json` declares license `Apache-2.0`.
- Integration harness: `fake-indexeddb@6.2.5` through `src/test/setup.ts`.
- Browser confirmation: Playwright Chromium, installed into workspace-local `.ms-playwright` cache and run with `PLAYWRIGHT_BROWSERS_PATH=.ms-playwright`.

## Prototype shape

Implemented in `src/infrastructure/db/storage-atomicity-spike.ts`.

Stores follow the target contract from `codex-spec/architecture/data-and-state.md`:

| Store | Primary key | Indexes used in spike |
|---|---|---|
| `documents` | `id` | `normalizedTitle`, `normalizedFileName`, `lastOpenedAt`, `updatedAt` |
| `documentVersions` | `id` | `documentId`, `state`, `contentHash`, `[documentId+state]`, `jobId`, `importedAt` |
| `chunks` | `[versionId+ordinal]` | `versionId`, `[versionId+sourceStart]`, `jobId`, `batchOrdinal` |
| `readerStates` | `documentId` | `updatedAt` |
| `preferences` | `key` | none |

Spike-only staging bookkeeping currently lives on `documentVersions`: `expectedCurrentVersionId`, `nextBatchOrdinal`, `stagedChunkCount` and `lastStagedOrdinal`. P01-T02 may keep these fields or move them to a dedicated job table, but the observable contract must remain the same: repository rejects stale jobs, duplicate/out-of-order batches, missing chunk ranges and stale current-version preconditions.

Each `DocumentVersion.layouts` record contains the complete base strategy set: `auto`, `h1`, `h2`, `h3` and `whole`.

## Transaction decisions

- `stageVersion` writes only a staging `documentVersions` record. For a new document, no `documents` row exists until commit.
- `appendChunkBatch` is a short `documentVersions + chunks` transaction. It checks job ownership, monotonic `batchOrdinal`, contiguous chunk ordinals, ordered source ranges and pipeline version before updating staging counters.
- `commitVersion` is a short `documents + documentVersions + chunks + readerStates` transaction. It validates complete chunk coverage, layout coverage, source ranges and expected-current precondition before changing `currentVersionId`.
- Replace commit returns the replaced ready version id, but old ready cleanup is intentionally post-commit and idempotent. Cleanup failure is recoverable garbage, not rollback.
- `abortVersion(jobId)` deletes only staging versions owned by that job. Ready versions with the same job id are not removed.
- `cleanupAbandonedStaging` filters by `state=staging`, age and active job ids. It never uses `clear()` or deletes ready data.
- `listVisibleDocuments` joins `documents.currentVersionId` to a complete `ready` version and hides partial/corrupt staging.

## Failure matrix

| Scenario | Result | Evidence |
|---|---|---|
| New import staged and appended | Hidden from library until commit; visible only after ready pointer exists | `keeps staging invisible...` |
| Quota-like append failure after chunk writes | Transaction rolls back chunks and staging counters | `rolls back a quota-like append failure...` |
| Replace commit failure before pointer switch | Previous ready version remains current; replacement stays staging/hidden | `preserves the previous ready version...` |
| Missing chunk range | Commit rejects with `MISSING_CHUNK_RANGE` | `rejects missing, duplicate and out-of-order...` |
| Duplicate batch ordinal | Append rejects with `DUPLICATE_BATCH` | same test |
| Out-of-order batch ordinal | Append rejects with `OUT_OF_ORDER_BATCH` | same test |
| Stale replace precondition | Commit rejects with `CURRENT_VERSION_CONFLICT`; winner stays current | `rejects stale expected-current...` |
| Abort job where ready version shares job id | Only staging is removed; ready version survives | `keeps cleanup scoped...` |
| Post-commit cleanup failure | Current pointer remains on new ready version; retry removes old ready data | same test |
| Reload between batches | New repository instance hides staging; scoped cleanup removes abandoned job only | `cleans abandoned staging...` |
| Persisted invalid source ranges | Commit rejects with `INVALID_CHUNK_RANGE` | `rejects invalid persisted source ranges...` |
| Legacy v1 migration | Source recovery and the complete five-strategy layout shape survive; version is marked pipeline `0` for rebuild | `upgrades a legacy fixture...` |
| Real browser Blob storage | Chromium IndexedDB preserves Blob and `sourceBlob.text()` after commit | `e2e/storage-atomicity.spec.ts` |

## Dexie/browser differences

`fake-indexeddb@6.2.5` did not preserve Node `Blob` or typed-array prototypes in the legacy migration fixture; the stored values came back as plain objects. The fake-IDB migration test therefore includes a fixture-only `sourceBytes` fallback to prove raw-byte recovery and migration logic in Node. The Chromium Playwright confirmation proves the production path: a real browser IndexedDB round trip preserves `Blob` and allows `sourceBlob.text()`.

Production implication for P01-T02: keep fake-IDB integration tests for transaction invariants, but retain at least one real-browser IndexedDB smoke whenever source Blob, quota, migration or recovery behavior changes. Do not treat fake-IDB Blob behavior as browser evidence.

## Contract updates for P01-T02

- Keep staging and publication separated; do not hold a transaction across worker compute.
- Commit must validate chunk count, contiguous ordinals, ordered source ranges, pipeline equality and layout coverage before pointer switch.
- Replacement must require `expectedCurrentVersionId`; `COMMIT_CONFLICT` is recoverable and preserves old `ReaderState`.
- Cleanup must be scoped by job/version ids and retryable; broad table clearing is not an acceptable recovery action.
- Migration/rebuild must preserve `sourceBlob` even if derived fields are stale or invalid. A stale `pipelineVersion=0` fixture confirms rebuild input remains available.
- Library visibility must derive from `Document + current ready version + complete chunks`, not from staging rows.

## Verification commands

Passed during the P00-T03 run:

```powershell
corepack pnpm exec vitest run src/infrastructure/db/storage-atomicity-spike.test.ts --reporter verbose
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
$vite = Start-Process -FilePath node -ArgumentList "node_modules/vite/bin/vite.js", "--host", "127.0.0.1" -PassThru -WindowStyle Hidden
$env:PLAYWRIGHT_BROWSERS_PATH = ".ms-playwright"
corepack pnpm exec playwright test e2e/storage-atomicity.spec.ts --project=chromium
Stop-Process -Id $vite.Id
corepack pnpm build
```

Chromium was installed into workspace-local `.ms-playwright`, and that cache is ignored in git. For browser verification in the Windows/Codex sandbox, Vite was started separately, Playwright reused the existing server, and only the recorded Vite PID (`41200` in the final run) was terminated afterward. The test passed; Playwright's managed webServer teardown hangs in this sandbox, so normal Playwright/CI configuration remains unchanged unless the issue is reproduced in a normal terminal.

## Outcome

P00-T03 acceptance is satisfied for the spike scope. P01-T02 is unblocked for production schema/repository/migration work, with the explicit carry-over requirement that fake-IDB is transaction evidence, while Blob persistence continues to require browser confirmation.
