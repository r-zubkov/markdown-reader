# Data and state

## General Conventions

- IDs: UUID strings from `crypto.randomUUID()`; not auto-increment.
- Time: integer UTC epoch milliseconds (`number`), formatted by UI through `Intl`.
- Ratios: finite `number` in `[0,1]`; byte/source offsets are non-negative safe integers.
- Enum values are stored lowercase and validated on read.
- `DB_SCHEMA_VERSION`, `PIPELINE_VERSION`, `WORKER_PROTOCOL_VERSION` are separate constants.
- Persistent records pass runtime schema validation. Invalid record is not cast to a domain type.

## Domain contracts

```ts
type DocumentId = string & { readonly __brand: 'DocumentId' };
type VersionId = string & { readonly __brand: 'VersionId' };
type ReadingMode = 'continuous' | 'sections';
type SplitStrategy = 'auto' | 'h1' | 'h2' | 'h3' | 'whole';
type ModeOrigin = 'auto' | 'user';
type RestoreConfidence = 'exact' | 'approximate' | 'none';

interface Document {
  id: DocumentId;
  title: string;
  normalizedTitle: string;
  fileName: string;
  normalizedFileName: string;
  currentVersionId: VersionId;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

interface DocumentVersion {
  id: VersionId;
  documentId: DocumentId;
  jobId: string;
  state: 'staging' | 'ready';
  contentHash: string;          // lowercase SHA-256 hex
  byteLength: number;
  charLength: number;
  encoding: 'utf-8';
  sourceBlob: Blob;
  title: string;
  outline: OutlineItem[];
  layouts: Record<SplitStrategy, SectionLayout>;
  chunkCount: number;
  pipelineVersion: number;
  importedAt: number;
  readyAt?: number;
}

interface OutlineItem {
  id: string;                  // app-prefixed deterministic heading id
  level: 1 | 2 | 3;
  text: string;
  pathKey: string;
  sourceStart: number;
  chunkOrdinal: number;
  childIds: string[];
}

interface SectionLayout {
  strategy: SplitStrategy;
  sectionIds: string[];
  sections: SectionRef[];
  safeForSelection: boolean;
  unavailableReason?: 'DOM_BUDGET' | 'OVERSIZED_NODE' | 'POC_LIMIT_UNKNOWN';
}

interface SectionRef {
  id: string;
  title?: string;
  startChunkOrdinal: number;
  endChunkOrdinalInclusive: number;
  headingId?: string;
  estimatedCost: number;
}
```

`whole` has one `SectionRef`, but its range is read through bounded windows. `safeForSelection=false` forbids user-visible selection until the budget is fixed/passed.

```ts
type SanitizedHtml = string & { readonly __brand: 'SanitizedHtml' };

interface PersistedChunk {
  versionId: VersionId;
  ordinal: number;
  html: string;                // persisted unbranded bytes
  pipelineVersion: number;
  sourceStart: number;
  sourceEnd: number;
  estimatedCost: number;
  headingIds: string[];
  blockAnchors: BlockAnchor[];
  renderState: 'ready' | 'safe-fallback';
  diagnosticCode?: 'HIGHLIGHT_FAILED' | 'OVERSIZED_NODE' | 'FRAGMENT_FALLBACK';
}

interface BlockAnchor {
  blockId: string;             // stable within version
  headingPathKey: string;
  blockOrdinalWithinHeading: number;
  sourceStart: number;
  sourceEnd: number;
}

interface SemanticAnchor {
  versionId: VersionId;
  headingPathKey: string;
  blockOrdinalWithinHeading: number;
  blockId: string;
  intraBlockRatio: number;
  overallSourceRatio: number;
}

interface ReaderState {
  documentId: DocumentId;
  readingMode: ReadingMode;
  modeOrigin: ModeOrigin;
  splitStrategy: SplitStrategy;
  anchor?: SemanticAnchor;
  progressRatio: number;
  lastSectionId?: string;
  updatedAt: number;
}

interface AppPreferences {
  key: 'app';
  theme: 'system' | 'light' | 'dark';
  remoteImagesEnabled: boolean;
  desktopTocCollapsed: boolean;
  updatedAt: number;
}
```

Repository returns `SanitizedHtml` only after runtime record validation plus equality `chunk.pipelineVersion === current PIPELINE_VERSION` plus ownership by the current ready version. The only factory is private to the infrastructure boundary.

## Relationships

```mermaid
erDiagram
    DOCUMENT ||--o{ DOCUMENT_VERSION : has
    DOCUMENT ||--|| READER_STATE : owns
    DOCUMENT_VERSION ||--o{ CHUNK : contains
    DOCUMENT_VERSION }o--|| DOCUMENT : current
```

Document has exactly one `currentVersionId`. Staging versions may exist, but they are not current/visible. After replace, the old ready version may temporarily exist until cleanup.

## IndexedDB schema

Target Dexie stores; exact syntax is fixed by P01-T02 after the spike:

| Store | Primary key | Required indexes | Purpose |
|---|---|---|---|
| `documents` | `id` | `normalizedTitle`, `normalizedFileName`, `lastOpenedAt`, `updatedAt` | Library metadata/similarity candidates |
| `documentVersions` | `id` | `documentId`, `state`, `contentHash`, `[documentId+state]`, `jobId`, `importedAt` | Raw source, published/staging versions |
| `chunks` | `[versionId+ordinal]` | `versionId`, `[versionId+sourceStart]` | Ordered bounded reader windows |
| `readerStates` | `documentId` | `updatedAt` | Per-document mode/strategy/progress |
| `preferences` | `key` | none | Global theme/privacy/TOC preference |

No index stores full title/content tokens for search in MVP. Exact duplicate query uses indexed `contentHash` and confirms version `ready`/current document validity.

### P00-T03 storage spike findings for P01-T02

P00-T03 confirmed the target stores above with Dexie short transactions and reusable fake-IDB/browser tests. Production P01-T02 must preserve these observed contracts even if implementation details move staging bookkeeping to a separate job table:

- staging tracks expected current version, next batch ordinal, staged chunk count and last staged ordinal;
- append runs in short `documentVersions + chunks` transactions and rejects wrong job, duplicate/out-of-order batch, non-contiguous chunk ordinal, invalid source range and pipeline mismatch;
- commit runs in one short `documents + documentVersions + chunks + readerStates` transaction, validates complete chunks/layouts/ranges and only then flips `documents.currentVersionId`;
- replace requires `expectedCurrentVersionId`; stale replace returns `COMMIT_CONFLICT` and leaves the previous ready version/current reader state usable;
- old ready cleanup is post-commit, scoped by explicit version id and retryable; abandoned staging cleanup is scoped by job/age/active-job ids and never uses broad clear;
- library visibility joins `Document.currentVersionId` to a complete `ready` version and hides staging/corrupt partial data;
- migration/rebuild preserves source bytes. `fake-indexeddb` is sufficient for transaction invariants but did not preserve Node `Blob` shape in the legacy fixture; real-browser IndexedDB smoke remains required for `sourceBlob` recovery evidence.
- persisted layouts contain all five strategies: `auto`, `h1`, `h2`, `h3` and `whole`.

## State ownership matrix

| State | Lifetime | Owner/source of truth | Change mechanism |
|---|---|---|---|
| Documents/current versions/chunks | Persistent | IndexedDB repository | Staged import/atomic commit/delete transaction |
| Reader mode/strategy/anchor/progress | Persistent | `readerStates` | Reader use cases; throttled controller + explicit mode switch |
| Theme/remote images/TOC collapse | Persistent | `preferences` | Platform preference use case; pre-paint theme mirror described below |
| Current route/document/hash | URL | React Router/browser history | Links/navigation/hash adapter |
| Import stage/progress/error | Ephemeral session | `ImportController` reducer | Worker/repository events |
| Open dialog/sheet/menu, focus owner | Ephemeral UI | Owning feature component/React Aria | User events/route changes |
| Virtual window measurements | Ephemeral imperative | Virtualizer adapter | Resize/scroll observers |
| Top visible semantic block | Ephemeral mutable controller, periodically persisted | `ReaderLocationController` | Observer/virtualizer callback |
| Online/update/storage health | Session/platform | Platform adapters | Browser/SW/storage events |
| Library scroll/focus return | Session | Route-level UI state/browser | Navigation/focus policy; not durable across browser restart |

Do not copy current Document/ReaderState into a global React store. Narrow live queries return metadata; transient optimistic state is allowed only while mutation is pending and must not depict irreversible success.

## Theme bootstrap mirror

To prevent a wrong-theme flash, the minimal `theme` string may be mirrored into `localStorage` only as a pre-paint hint. IndexedDB `preferences` remains the source of truth; after startup:

1. a small self-hosted bootstrap script loaded before the app entry applies the `system/light/dark` hint before React paint; an acceptable alternative is a build-generated fixed CSP hash for an inline script, but not `unsafe-inline`;
2. preferences adapter reads IndexedDB;
3. if values differ, IndexedDB is applied and the mirror is updated;
4. preference change atomically writes IndexedDB, then the mirror.

No document/progress data is stored in `localStorage`.

## Normalization and Identity

- `fileName`: basename, Unicode preserved; path is not available/stored.
- `normalizedFileName`: Unicode NFKC, trim, collapse whitespace, locale-independent lowercase, strip final `.md` for candidate matching.
- `title`: plain text of the first H1 after inline Markdown normalization; otherwise filename without extension; nonempty bounded display string.
- `normalizedTitle`: same NFKC/whitespace/lowercase policy.
- Similarity: exact match normalized filename or title. Multiple candidates are not selected automatically; UI offers target selection or add separately.
- Exact identity: SHA-256 raw bytes, not decoded text. Hash duplicate is allowed even with a different filename.

## Heading, Chunk and Anchor IDs

- Heading slug is built from normalized visible text; ID format is `mdr-h-{slug-or-heading}-{occurrence}`. Occurrence is counted in document order.
- `pathKey` includes ancestry levels/text occurrence, for example `1:introduction[1]/2:setup[2]`; it contains no raw HTML.
- Block ID is stable within a version: hash/ordinal from normalized block type plus source range; cross-version mapping does not rely on it alone.
- Chunk ordinal is contiguous `0..chunkCount-1`; commit rejects gaps/duplicates/overlap/out-of-order source ranges.
- Layout ranges must be valid, ordered, non-overlapping and cover chunks according to strategy; property tests prove coverage.

## Import, Serialization and Validation

1. Validate one `.md` (case-insensitive extension); MIME is a hint, not authority.
2. Enforce measured byte limit before full read.
3. Fatal UTF-8 `TextDecoder`; invalid input fails without partial document.
4. Hash raw bytes; parse decoded text once.
5. Build metadata/outline/chunks/layouts with numeric limits.
6. Persist batches as structured clone records. HTML is a string but trusted only by provenance/version validation.
7. Commit verifies hash, counts, version/job ownership, ranges and expected current version precondition.

Persisted content never includes live DOM nodes, React elements, complete AST or generated object URLs.

## Atomicity and lifecycle

### New document

- Allocate provisional `documentId`, `versionId`, `jobId`.
- Stage DocumentVersion + batches; Document record absent.
- Commit transaction validates all records, creates Document and default ReaderState, flips version ready/current.

### Replace

- Capture `expectedCurrentVersionId` and old ReaderState.
- Stage new version under same `documentId`.
- Map anchor before/within commit result.
- Commit only if Document still points to expected current version; otherwise `COMMIT_CONFLICT`.
- Old version/chunks cleanup occurs after successful switch; cleanup is idempotent.

### Cancel/failure/startup cleanup

- `abortVersion(jobId)` deletes only that staging version/chunks.
- Startup removes staging older than measured/defined abandonment duration only when no active same-tab job marker; no ready version is touched.
- Cleanup may be retried. UI visibility derives only from Documents + current ready version.

### Delete

One transaction deletes ReaderState, all chunks for all document versions, versions, then Document. UI removes item only after success. Preferences remain.

## Versioning and migrations

- Dexie migrations are forward-only, idempotent at record transformation level and separately integration-tested with fixtures from every prior schema shipped.
- Migration never deletes `sourceBlob` merely because derived fields are invalid. On unsafe migration failure, app opens recovery state and preserves records.
- Pipeline mismatch sets derived status stale; rebuild stages from Blob and atomic-switches. Reader may use old ready derived data only if its sanitizer policy is still allowed; a security-invalid pipeline forces blocking reprocess.
- Worker protocol mismatch aborts job; main/worker bundles from different SW versions trigger update/reload guidance, not best-effort parsing.

## Progress persistence and mapping

- Observer selects top visible meaningful block relative to sticky toolbar.
- `intraBlockRatio` estimates progress within that block; `overallSourceRatio` is fallback and library percentage source.
- Writes are trailing-throttled; exact interval is performance implementation detail measured in P03-T04. Explicit TOC/mode/route actions flush immediately.
- Mapping order on mode/strategy: same block → same heading path + ordinal → nearest heading → source ratio → start.
- Mapping across version: normalized path with occurrence → nearest matching ancestor/block ordinal → source ratio. Result returns confidence and reason.
- `none` opens start and visible notice; `approximate` shows dismissible notice. Confidence never inferred silently in UI.

## Quota, corruption, limits

- Before import, `StorageManager.estimate()` can warn but cannot guarantee commit. `QuotaExceededError` aborts staging and leaves ready data.
- `persist()` is requested only after user context/success explanation; denial is warning, not block.
- Record validation failure localizes to version/chunk when possible. Corrupted current derived data prompts rebuild from source; corrupted/missing source prompts reimport, never automatic clear-all.
- File/node/chunk/decoded data limits come from F00 spikes and live in one `PipelineLimits` config with test fixtures at/below/above each limit.
- Browser eviction cannot be recovered in MVP; copy explicitly tells user to retain original `.md`.

## Import/export/clear

- Import supports only one source `.md` and replacement/separate decisions.
- Library export/restore is deferred; no hidden unstable format is exposed.
- Delete one document is supported. Clear-all-data is not an MVP UI action; diagnostics may explain browser site-data controls but never invoke them as first recovery.
