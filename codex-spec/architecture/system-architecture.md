# System architecture

## Architectural style

Client-only modular SPA with ports/adapters and a local-first persistence model. React owns composition and interaction; pure TypeScript domain owns parsing policies, partitioning, duplicate/update decisions and position mapping; infrastructure owns browser APIs. Heavy untrusted-content work runs in a dedicated worker.

This is not formal Clean Architecture ceremony: boundaries exist only where they separate React, storage, worker and the untrusted content pipeline.

## Runtime context

```mermaid
flowchart TD
    U["User"] --> UI["React SPA"]
    UI --> W["Import Worker"]
    UI --> DB["IndexedDB / Dexie"]
    UI --> P["Browser platform"]
    P --> N["HTTPS images · optional"]
```

- Static host serves hashed assets, SPA fallback and security headers from a stable HTTPS origin.
- Service worker precache contains only app shell/build assets. Document bytes and derived content live in IndexedDB.
- Network is not needed for import/read. The only exception is permitted HTTPS remote-image loading; it is not cached as a document asset.
- File picker/DropZone pass a browser `File`; there are no upload requests.

## Modules and Responsibilities

| Layer/module | Responsibility | Must not |
|---|---|---|
| `app` | Composition root, providers, router, route boundaries, global statuses | Parse Markdown or request chunks directly from Dexie tables |
| `features/library` | Library query/use cases, import/delete entry points, list UI | Own DB schema or compute duplicate policy |
| `features/import` | Import UI reducer/controller, worker/repository orchestration adapter | Sanitize HTML in UI or publish staging records directly |
| `features/reader` | Reader shell, TOC/settings, virtualizer adapter, location controller | Store whole document/chunk corpus or change pipeline rules |
| `domain/documents` | Entities, normalized identity, layouts, duplicate/update policy | Import React/DOM/Dexie |
| `domain/content` | AST block model, partition invariants, heading IDs, URL/content policy contracts | Use browser DOM as sanitizer |
| `domain/reading` | Semantic anchor, mapping confidence, progress calculation | Store pixel offset as canonical location |
| `application` | Use-case ports: import, replace, delete, open, reprocess | Depend on concrete UI primitives |
| `infrastructure/db` | Dexie schema, repositories, migrations, atomic commit/cleanup | Return unvalidated stale HTML as safe |
| `infrastructure/platform` | storage health, online status, theme bootstrap, URL/hash, PWA update | Contain product business rules |
| `workers` | Decode, hash, parse, partition, sanitize, highlight, batching | Mutate UI/React or use unversioned messages |
| `ui/primitives` | Installed/adapted shadcn React Aria components | Contain feature state machines |

## Allowed Dependencies

```mermaid
flowchart TD
    A["app + features"] --> B["application ports"]
    A --> C["ui primitives"]
    B --> D["domain"]
    E["infrastructure + workers"] --> B
    E --> D
```

`domain` is the lower independent layer. Infrastructure implements ports and is injected by the composition root. A feature may use domain types, but side effects go through application/repository ports. Lint/import-boundary tests must forbid reverse dependencies.

## Routes and Entry Points

| Route | Entry | Exit/behavior |
|---|---|---|
| `/` | Startup, logo, Back from reader | Library; import/delete/replace overlays do not create a standalone route |
| `/documents/:documentId` | Open/continue/success/duplicate | Restore saved anchor; missing local document -> recovery state |
| `/documents/:documentId#heading-id` | Explicit TOC/deep link | Hash overrides saved anchor once; invalid heading -> nearest ancestor/start notice |
| `*` | Unknown URL | Route error state + link to `/` |

Mode/strategy are per-document preferences in IndexedDB, not query params. Passive scroll does not write browser history.

## Import data flow

```mermaid
sequenceDiagram
    participant UI as ImportFlow
    participant C as Coordinator
    participant W as Worker
    participant R as Repository
    UI->>C: start(File, intent)
    C->>W: ImportRequest(jobId, File)
    W-->>C: metadata + hash
    C->>R: find duplicate/candidates
    C-->>UI: decision if needed
    W-->>C: ChunkBatch*
    C->>R: stage + append batches
    W-->>C: Complete
    C->>R: commitVersion(...)
    R-->>UI: ready document/result
```

1. UI pre-validates one `.md`; worker performs authoritative byte length and fatal UTF-8 decode.
2. Worker computes SHA-256 and metadata. Coordinator checks exact ready-version hash before finalizing.
3. If user decision is needed, worker result/job remains controlled staging; cancel removes it.
4. Worker sends bounded batches with monotonic `batchOrdinal`; repository rejects wrong job/protocol/order.
5. Commit transaction creates/updates Document, marks version ready, sets `currentVersionId`, maps reader state and publishes library visibility.
6. Previous ready version is deleted only in post-commit cleanup. A failed cleanup is recoverable garbage, not data loss.

Cancellation: controller sends `Cancel(jobId)`, ignores later nonterminal messages for that job, terminates worker after bounded handshake timeout, calls `abortVersion`, and returns UI to `cancelled`. Browser/tab termination leaves staging for startup cleanup.

## Reader data flow and state ownership

1. Route supplies `documentId` and optional hash.
2. Reader use case loads Document + current ready version metadata + ReaderState.
3. Location resolver chooses explicit heading, saved anchor or document start.
4. Repository returns layout metadata and only chunk range required by current section/virtual window.
5. `SafeHtmlChunk` renders repository-branded values. It does not sanitize or transform.
6. Intersection/virtualizer callback updates an imperative `ReaderLocationController`; derived progress is throttled into ReaderState, not React state per scroll event.
7. `pagehide`, route leave and deliberate mode change trigger final best-effort persistence without unload prompt.

## Worker protocol

Every message contains `protocolVersion` and `jobId`.

```ts
type MainToWorker =
  | { type: 'import.request'; protocolVersion: number; jobId: string; file: File; limits: PipelineLimits }
  | { type: 'import.continue'; protocolVersion: number; jobId: string; decision: ImportDecision }
  | { type: 'import.cancel'; protocolVersion: number; jobId: string };

type WorkerToMain =
  | { type: 'import.progress'; protocolVersion: number; jobId: string; stage: ImportStage; ratio?: number }
  | { type: 'import.metadata'; protocolVersion: number; jobId: string; metadata: ParsedMetadata }
  | { type: 'import.chunkBatch'; protocolVersion: number; jobId: string; batchOrdinal: number; chunks: PersistableChunk[] }
  | { type: 'import.complete'; protocolVersion: number; jobId: string; result: PipelineResult }
  | { type: 'import.failure'; protocolVersion: number; jobId: string; error: ImportError }
  | { type: 'import.cancelled'; protocolVersion: number; jobId: string };
```

Actual contracts live in a shared protocol module that imports no worker/DOM globals. Unknown version/message fails closed with `PROTOCOL_MISMATCH`.

## Async processes and concurrency

- MVP allows one active import per tab at a time; an additional attempt focuses the current flow. This avoids unmeasured memory amplification.
- IndexedDB transactions serialize publication. `currentVersionId` is changed only when all expected batches exist and metadata counts/ranges validate.
- Multiple tabs may observe Dexie writes, but MVP does not promise collaborative coordination. Commit uses current-version precondition; stale replacement aborts with recoverable conflict.
- Pipeline rebuild after `PIPELINE_VERSION` mismatch creates a new staging derived version from same source Blob and uses the same atomic switch.
- Service-worker update may be prepared anytime, but reload/apply is disabled while import/finalization is active.

## Error model and recovery

| Boundary | Stable errors | Recovery |
|---|---|---|
| File | `MULTIPLE_FILES`, `UNSUPPORTED_EXTENSION`, `FILE_TOO_LARGE`, `INVALID_UTF8` | Select another/resave UTF-8 |
| Worker | `PROTOCOL_MISMATCH`, `PIPELINE_LIMIT`, `WORKER_CRASH`, `CANCELLED` | Abort staging; retry after diagnostics |
| Content | `UNSUPPORTED_LANGUAGE`, `HIGHLIGHT_FAILED`, `OVERSIZED_NODE` | Escaped safe fallback for node; import continues when integrity is known |
| Storage | `DB_UNAVAILABLE`, `QUOTA_EXCEEDED`, `MIGRATION_FAILED`, `COMMIT_CONFLICT` | Keep ready data; retry/free space/reimport; never auto-clear |
| Reader | `DOCUMENT_NOT_FOUND`, `STALE_DERIVED`, `CHUNK_READ_FAILED`, `ANCHOR_NOT_FOUND` | Library/reprocess/partial placeholder/approximate fallback |
| Platform | `OFFLINE_RESOURCE`, `UPDATE_FAILED`, `PERSISTENCE_DENIED` | Local read continues; retry/later/explanation |

Route error boundary catches unexpected React failures only. Expected domain errors use typed Result and screen states.

## Trust boundaries and security

- Untrusted: filename, bytes, decoded Markdown, AST raw HTML, heading text, language labels, URLs and existing IndexedDB content.
- Raw HTML nodes are converted to escaped literal text. `allowDangerousHtml` is false; `rehype-raw` is not used in MVP.
- URL policy runs before serialization; sanitizer allowlist runs after HAST transformations/highlight and before stringify. Sanitized output is rebranded only by repository when `pipelineVersion` matches.
- Heading/footnote IDs are application-generated with a fixed prefix, slug + occurrence; user-provided `id/name` is discarded to prevent clobbering.
- Links: allow `#`, `http`, `https`, `mailto`; external HTTP(S) gets `_blank`, `rel="noopener noreferrer"`. Block `javascript`, `data`, `file`, `blob` and unknown protocols.
- Images: allow `https` when preference on and safe raster `data:image/{png,jpeg,gif,webp,avif}` under measured decoded limit; block SVG data, HTTP, file/blob and relative paths. Use `referrerpolicy="no-referrer"`, lazy/async decode.
- CSP target: `default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self'`. Deployment must decide whether Tailwind/generated styles require a nonce/hash change; `unsafe-eval` is forbidden.
- Diagnostics include error codes/counts/sizes, never document text or full URLs containing secrets.

## Proposed source tree

```text
src/
  app/                    # composition, router, providers, error boundaries
  application/            # use cases and ports
  domain/
    documents/
    content/
    reading/
  features/
    library/
    import/
    reader/
    platform-status/
  infrastructure/
    db/
    platform/
    pwa/
  workers/
  ui/
    primitives/
    theme/
  styles/
    reader-content.css
  test/
    fixtures/
    corpus/
e2e/
```

Do not create placeholder folders before the task that introduces their responsibility.

## Forbidden Shortcuts

- Parse/sanitize/highlight in React render/main thread.
- One giant HTML string, persisted full AST or whole-document `chunks[]` in Context.
- Direct Dexie imports from screen components.
- `dangerouslySetInnerHTML` outside `SafeHtmlChunk` or branding through a plain cast.
- Publishing Document before complete batch validation.
- Pixel scrollTop as source of truth.
- Strategy `whole` that mounts the whole document.
- Second sanitizer "just in case", permissive raw HTML or dynamic execution.
- Silent data deletion during migration/quota/corruption.
- Auto-reload service worker during active task.

## Verified Unstable Details

- [React Router 8](https://reactrouter.com/) has a modern baseline of Node 22+ and React 19+; bootstrap verifies the current exact minimum patches.
- [React Router modes](https://reactrouter.com/start/modes) confirm Declarative Mode as the least architecture-imposing option.
- [shadcn React Aria base](https://ui.shadcn.com/docs/changelog/2026-07-react-aria) and `--base aria` are available, but component/focus PoC is mandatory.
- [TanStack React Virtual](https://tanstack.com/virtual/latest/docs/framework/react/react-virtual) documents `useFlushSync` and `directDomUpdates`; both are measured options, not specification defaults.
- [Vite PWA React integration](https://vite-pwa-org.netlify.app/frameworks/react) supports prompt update; callback state must use stable references.
