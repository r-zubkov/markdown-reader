# Requirements and Decisions

## Source Precedence Used

1. Latest explicit user decisions: the product is a web reader for Markdown files, not a specialized long-publication reader; desktop/mobile have equal priority; light/dark themes; technical-editorial direction; execution documentation is English-only; Chrome is the only MVP browser commitment, with Firefox, Safari/WebKit and physical iPhone testing outside the matrix.
2. Security, data integrity and actual platform constraints.
3. Technical blueprint for implementation.
4. Product blueprint for behavior/scope.
5. Design blueprint for UX/presentation; as the later document, it refines the UI stack.
6. Reversible assumptions in this specification set.

## Normalized Requirements

### Product

| ID | Verifiable rule | Source |
|---|---|---|
| PRD-001 | The app works without an application backend; Markdown documents and progress remain in the current origin/profile. | SOURCE |
| PRD-002 | Import accepts exactly one `.md`, validates UTF-8 and does not publish a document until complete success. | SOURCE |
| PRD-003 | Library survives reload, shows title/progress and allows opening/continuing a document. | SOURCE |
| PRD-004 | Reader displays CommonMark + GFM, including tables, task lists, footnotes and fenced code. | SOURCE |
| PRD-005 | The full-document outline contains the `H1-H3` hierarchy; selecting a heading navigates to it in any mode. | SOURCE |
| PRD-006 | Continuous mode looks like one uninterrupted stream without load-more controls and does not mount the whole large document. | SOURCE |
| PRD-007 | Sections mode shows one logical part, pager and a localized section counter with title. | SOURCE |
| PRD-008 | Before explicit user choice, initial mode is determined by a measured document size/cost threshold. | SOURCE + DERIVED |
| PRD-009 | Strategies `auto/h1/h2/h3/whole` are available; they define section layout but do not disable chunks. | SOURCE + DERIVED |
| PRD-010 | All content is available and preserves order; a whole AST block is not split in the middle. | SOURCE |
| PRD-011 | Progress is saved automatically and restores semantic position after reload/mode/strategy switch. | SOURCE |
| PRD-012 | Exact duplicate by SHA-256 is not created; the user is offered the existing document. | SOURCE |
| PRD-013 | Possible update by normalized filename/title offers replace/separate/cancel; replace keeps `documentId` and tries to map progress. | SOURCE |
| PRD-014 | Delete requires explicit confirmation and transactionally deletes the document, versions, chunks, settings/progress. | SOURCE |
| PRD-015 | After first online load, the app shell and local documents are available offline; first offline visit is not promised. | SOURCE |
| PRD-016 | MVP includes `system/light/dark`; manual choice persists globally. | SOURCE (latest explicit) |
| PRD-017 | HTTPS remote images may load only when the preference permits it; relative local resources show an unsupported placeholder. | SOURCE + DERIVED |
| PRD-018 | Search, editing, backup, sync, notes, bookmarks, folders/assets and backend are outside MVP. | SOURCE |

### Technical

| ID | Verifiable rule | Source |
|---|---|---|
| TECH-001 | Greenfield stack: React 19.2 current compatible patch, TypeScript strict, Vite 8.1, React Router 8 Declarative, Node `>=22.22`. | SOURCE + VERIFIED |
| TECH-002 | Domain does not depend on React/DOM/Dexie; UI calls use cases/ports; repository is the only IndexedDB boundary. | SOURCE |
| TECH-003 | Decode/hash/parse/partition/sanitize/highlight run in a Web Worker with versioned typed protocol, progress and cancel. | SOURCE |
| TECH-004 | Pipeline uses unified + remark parse/GFM -> HAST; heading/source positions and anchors are extracted before serialization. | SOURCE |
| TECH-005 | Raw HTML is inert; allowlist sanitizer and URL policy run before `SanitizedHtml`; the only injection boundary is `SafeHtmlChunk`. | SOURCE |
| TECH-006 | Highlight uses lowlight and limited grammars; unknown/error/oversized code receives escaped plain-code fallback. | SOURCE |
| TECH-007 | Internal chunks group whole top-level AST nodes; layouts only reference chunk ranges. | SOURCE + DERIVED |
| TECH-008 | IndexedDB via Dexie stores source Blob, versions, chunks, reader state and preferences; UI does not store the full corpus. | SOURCE |
| TECH-009 | Import/replace use staging batches plus short atomic commit; abandoned staging is cleaned safely. | SOURCE |
| TECH-010 | `DB_SCHEMA_VERSION`, `WORKER_PROTOCOL_VERSION` and `PIPELINE_VERSION` are independent; pipeline mismatch rebuilds from source Blob. | SOURCE + DERIVED |
| TECH-011 | Continuous reader uses a bounded window with dynamic measurement; TanStack Virtual is accepted only after PoC. | SOURCE |
| TECH-012 | Persistent source of truth is IndexedDB; URL stores route/hash; React state is only ephemeral UI/state machines. | SOURCE |
| TECH-013 | Routes: `/`, `/documents/:documentId`, optional `#heading-id`, `*`; mode/strategy are not encoded in URL. | SOURCE |
| TECH-014 | UI shell: shadcn/ui React Aria base + Tailwind 4 + semantic CSS variables; rendered Markdown uses `.reader-content` CSS. | SOURCE (later design) |
| TECH-015 | PWA uses `vite-plugin-pwa` `generateSW`, app-shell precache and user-prompt update; documents are not stored in Cache Storage. | SOURCE |
| TECH-016 | Resolved package versions are fixed by the lockfile; bootstrap checks official peer/minimum requirements and does not use random prereleases. | DERIVED |

### UX

| ID | Verifiable rule | Source |
|---|---|---|
| UX-001 | `/` is a calm vertical library list: header CTA, local-storage explanation, stable activity sort, empty/loading/error/storage states. | SOURCE |
| UX-002 | Reader has sticky toolbar, document scroll and max-width prose; TOC is persistent only from 1120 px, otherwise Sheet. | SOURCE |
| UX-003 | Import is Dialog on desktop and Sheet/full-screen on mobile, with filename, honest stage/progress, cancel and actionable error. | SOURCE |
| UX-004 | Duplicate/update/delete use one controlled overlay flow, full action labels and deterministic focus return. | SOURCE |
| UX-005 | All core flows work at `<360`, `360-767`, `768-1119`, `1120-1439`, `>=1440`; 320 px has no page overflow. | SOURCE |
| UX-006 | Restore/apply/offline/update/quota/partial errors have visible state; recoverable error is not limited to a toast. | SOURCE |
| UX-007 | Keyboard, skip link, landmarks, focus-visible, overlay focus trap/return, reduced motion and 44x44 touch targets are mandatory. | SOURCE |
| UX-008 | External links are clearly marked and safe; code/table have local overflow; media failure does not break document flow. | SOURCE |

### Non-functional

| ID | Verifiable rule | Source |
|---|---|---|
| NFR-001 | File/chunk/DOM/overscan/memory budgets are determined by corpus benchmark; release does not use unconfirmed thresholds. | SOURCE |
| NFR-002 | Forced cancel/termination/reload never changes the current ready version and never leaves a visible partial document. | SOURCE |
| NFR-003 | Security corpus does not execute scripts/events, create clobbering IDs or leave unsafe URLs/attributes. | SOURCE |
| NFR-004 | Content/diagnostics are not sent or logged; remote image request is the explicit policy exception. | SOURCE |
| NFR-005 | Target is WCAG 2.2 AA; automated a11y is supplemented by keyboard, NVDA/VoiceOver, zoom/reflow and physical touch smoke. | SOURCE |
| NFR-006 | Release tests current stable Google Chrome through Playwright Chromium; mobile behavior is covered by responsive Chromium/mobile-Chrome emulation. Firefox, Safari, WebKit and physical iPhone testing are outside the MVP matrix. The hard supported floor is Chrome 111. | SOURCE (latest explicit) + VERIFIED |
| NFR-007 | Source Blob enables rebuild; quota/eviction are explained, but MVP honestly does not promise backup. | SOURCE |
| NFR-008 | Offline ready documents remain readable; unavailable remote media and update receive separate nonfatal states. | SOURCE |
| NFR-009 | UI locale is Russian; strings are separated from domain codes; sizes/percentages use `Intl`. | SOURCE |
| NFR-010 | All phase gates require typecheck/lint/tests/build and relevant E2E/security/performance checks; failed check blocks completion. | DERIVED |

## Found Conflicts and Resolutions

| ID | Conflict | Resolution | Basis |
|---|---|---|---|
| CON-001 | Product blueprint allowed one high-quality theme; later user/UI blueprint decision requires light + dark. | MVP includes `system/light/dark`. | Latest explicit user decision. |
| CON-002 | Technical blueprint proposed CSS Modules + React Aria; design blueprint says shadcn React Aria base + Tailwind 4. | UI shell follows design blueprint; domain/worker/storage boundaries from technical blueprint remain unchanged; `.reader-content` remains separate CSS. | Later UI decision in its area of ownership. |
| CON-003 | Technical blueprint named React `19.2.x` without patch; React Router 8 currently requires a compatible newer patch and Node 22.22+. | Do not pin an obsolete patch in spec; bootstrap installs current stable compatible patch and fixes the lockfile. | Official current compatibility/security. |
| CON-004 | `whole` can sound like one physical document, but technical blueprint requires bounded DOM. | `whole` is one logical section; internal chunks/virtual window remain. | Safety plus product no-truncation rule. |
| CON-005 | Product expects remote images online; privacy requires controlling external requests. | HTTPS images are allowed by preference `remoteImagesEnabled=true` by default, with `no-referrer`, lazy load and a visible global off switch; relative files are unsupported. | Preserves behavior while making the exception transparent and disableable. |
| CON-006 | Source materials mostly described long technical publications, while the latest user decision defines the product as a reader for any Markdown file. | Canonical entity is `Document`, route is `/documents/:documentId`, repository is `DocumentRepository`; large files remain a performance stress case but do not define the product category. | Latest explicit user decision; technical constraints for large files remain. |

## Decision Log

| ID | Decision | Status | Reason / review trigger |
|---|---|---|---|
| DEC-001 | Browser-only static PWA, without application backend. | SOURCE | Review only if mandatory sync/guaranteed backup appears. |
| DEC-002 | React/Vite/Router Declarative; current compatible stable patches. | SOURCE + VERIFIED | Review on repository constraint or failed framework PoC. |
| DEC-003 | `pnpm` plus committed lockfile and target scripts. | ASSUMPTION | Reversible before bootstrap; change if environment/organization requires another tool. |
| DEC-004 | Clean domain plus ports/adapters; UI framework does not enter domain. | SOURCE | Review only through ADR. |
| DEC-005 | Web Worker pipeline, staged Dexie commit and raw Blob recovery. | SOURCE | Streaming/native shell may change boundary after measured limit. |
| DEC-006 | AST chunks between top-level nodes; no full AST/HTML persistence. | SOURCE | Search/annotations add separate records and do not cancel source Blob. |
| DEC-007 | Strict sanitizer plus branded HTML boundary plus CSP. | SOURCE | Whitelisted raw HTML requires a separate security review/ADR. |
| DEC-008 | TanStack Virtual with the P00-T04 measured configuration is accepted; fallback is bounded manual window/sections. | SOURCE + VERIFIED | Re-run the P00-T04 benchmark when the adapter/dependency or production chunk shape changes. |
| DEC-009 | Semantic anchor, not pixel offset. P00-T05 accepts only stable same-version identity or a SHA-256 block fingerprint unique in both versions as exact; path/ancestor/qualified-ratio fallbacks are approximate. | SOURCE + VERIFIED | Recalibrate the `0.20` structural-similarity gate against the production update corpus in P03-T04/P04-T02. |
| DEC-010 | IndexedDB is persistent source of truth; no global store. | SOURCE | Sync/collaboration may require a new state layer. |
| DEC-011 | shadcn React Aria base + Tailwind 4; open-code primitives reviewed locally. | SOURCE (latest) | Failed component/focus PoC may allow local direct React Aria fallback. |
| DEC-012 | Light/dark/system global preference; no per-document theme. | SOURCE | Per-document personalization is post-MVP. |
| DEC-013 | Import success remains in library with CTA to open. | ASSUMPTION | Change after usability evidence; does not affect data model. |
| DEC-014 | Library list, not cover grid; sort by activity plus stable documentId. | SOURCE/DERIVED | Covers/large library may change post-MVP. |
| DEC-015 | Document/window scroll; TOC persistent only at `>=1120px`. | SOURCE + VERIFIED | P00-T04 confirmed window scroll in Chromium; revisit only if production profiling fails its budgets. |
| DEC-016 | Remote HTTPS images default on, disableable; no runtime caching. | DERIVED | Privacy testing may change default before release. |
| DEC-017 | `generateSW` prompt update; never silent reload during active import. | SOURCE | Complex runtime cache/background work may require `injectManifest`. |
| DEC-018 | Russian UI, string catalog boundary from the first UI task. | SOURCE | Adding locale support does not change domain errors. |
| DEC-019 | Release target is a production-oriented MVP after mandatory PoC gates. | ASSUMPTION | User may lower scope to prototype; current specs remain the upper boundary. |
| DEC-020 | Canonical terminology: product `Markdown Reader`, entities `Document`/`DocumentVersion`, identifier `documentId`, route `/documents/:documentId`. | SOURCE (latest) | Change only together with data schema, routes, repository contracts, UX copy and migration decision. |
| DEC-021 | `AGENTS.md` and every file under `codex-spec/` are English-only execution documents; exact Russian UI copy belongs in source catalogs or tests when needed. | SOURCE (latest explicit) | Review only if project documentation governance changes. |
| DEC-022 | Google Chrome is the only browser in the MVP support and release-test commitment, automated through Playwright Chromium. Firefox, Safari, WebKit and physical iPhone testing are explicitly excluded; responsive mobile Chrome remains required through Chromium emulation. | SOURCE (latest explicit) | Adding another browser requires its own compatibility pass and browser/device evidence. |

## Assumptions Register

| ID | Assumption | Risk | Reversible point |
|---|---|---|---|
| ASM-001 | A production-oriented MVP is needed, although the depth field in the source request was not filled. | More hardening tasks. | Before P05; individual phases can stop after walking skeleton. |
| ASM-002 | After import, the user remains in library. | User may expect auto-open. | One navigation policy in ImportFlow. |
| ASM-003 | `pnpm` is acceptable. | Local environment may use npm. | P00-T01 before committed lockfile. |
| ASM-004 | Remote HTTPS images are enabled by default but transparently disableable. | Privacy expectation. | Preference default before release migration. |
| ASM-005 | `Markdown Reader` is accepted as the canonical working name; neutral blue accent remains the working visual assumption. | Late brand accent change. | Semantic brand tokens/strings. |
| ASM-006 | User keeps the source file outside the app. | Eviction may lose the document. | Storage copy plus backup NEXT; durability cannot be promised. |

## Open Questions

| ID | Question | Blocks | Temporary answer |
|---|---|---|---|
| OPEN-001 | Final brand accent. | Does not block MVP architecture. | Semantic neutral-blue accent (`ASM-005`). |

There are no blocking user open questions. Numeric thresholds are mandatory PoC outputs, not questions that can be honestly settled by preference.

## Deferred Decisions

| ID | Deferred decision | Return when |
|---|---|---|
| DFR-001 | Maximum file size, node/chunk cost, DOM window, overscan and anchor tolerance. | After P00-T02/P00-T04/P00-T05 on a fixed corpus/device matrix. |
| DFR-002 | Final highlight grammar list and auto-detect confidence. | After corpus pipeline benchmark; before P02-T01. |
| DFR-003 | Backup/export format. | After MVP or earlier if eviction makes release unacceptable. |
| DFR-004 | Full-text search index/schema. | After stable block anchors and pipeline versioning. |
| DFR-005 | Typography user controls. | After visual QA of both base themes. |
| DFR-006 | Cross-tab coordination guarantees. | When E2E proves a real conflict; MVP only must avoid data damage. |

### Evidence Updates

| ID | Update | Status |
|---|---|---|
| DFR-001 | P00-T02 proposes `maxFileBytes=1_250_000` plus content-pipeline limits. P00-T04 adds `overscan=8`, cache `96`, mounted budget `48`, stabilized-drift tolerance `96px` and blank-gap tolerance `100ms`. P00-T05 adds zero-block exact tolerance, at-most-one-block approximate corpus tolerance and the `0.20` structural-similarity gate; reports live under `docs/benchmarks/`. P00-T06 records accepted React Aria primitive behavior, 320/390 responsive Chromium evidence and `dvh`/safe-area fallback limits in `docs/benchmarks/mobile-ui-platform-spike.md`. | Partially closed. Content, virtual-reader, semantic-mapping and responsive-platform proposals are measured; production tasks must rerun their applicable proposals. |
| DFR-002 | P00-T02 proposes expanded explicit lowlight set: `bash`, `c`, `cpp`, `csharp`, `css`, `diff`, `go`, `graphql`, `ini`, `java`, `javascript`, `json`, `kotlin`, `less`, `lua`, `makefile`, `markdown`, `objectivec`, `perl`, `php`, `plaintext`, `python`, `r`, `ruby`, `rust`, `scss`, `shell`, `sql`, `swift`, `typescript`, `wasm`, `xml`, `yaml`; aliases documented in spike report. Auto-detect remains gated by size/confidence and must not highlight low/medium-confidence unlabeled code. | Proposal until production rerun in P02-T01. |
| TECH-008/009/010, NFR-002/007 | P00-T03 added Dexie `4.4.5` storage atomicity prototype, fake-IDB integration tests, Chromium IndexedDB Blob confirmation and `docs/benchmarks/storage-atomicity-spike.md`. Staging/append/commit/abort/cleanup/migration/current-version preconditions are proven for spike scope. | Closes storage atomicity spike for P01-T02. `fake-indexeddb` Blob-shape divergence documented; source Blob recovery still requires browser smoke when production schema changes. |
| PRD-006/010, TECH-011, NFR-001/005/006, DEC-008/015/022 | P00-T04 selects `useWindowVirtualizer`, `overscan=8`, cache `96`, mounted budget `48`, `useFlushSync=false`, direct DOM updates off, 96 px stabilized-drift tolerance and 100 ms blank-gap tolerance. Chromium and responsive mobile-Chromium pass the automated 20,000-chunk scenarios. Details are in `docs/benchmarks/virtual-reader-spike.md`. | Closes the virtual-reader spike and finalizes DEC-008/015 for P01-T04/P03-T02. |
| PRD-011/013, TECH-010, DEC-009 | P00-T05 adds deterministic same/cross-version mapping reason codes, a unique SHA-256 block fingerprint exactness rule, ratio/range/determinism properties and exact/approximate/none UI triggers. `PIPELINE_VERSION` is `3` because persisted block anchors gained `contentFingerprint`. Details are in `docs/benchmarks/progress-mapping-spike.md`. | Closes the semantic mapping spike for P03-T03/P03-T04/P04-T02; production repository validation and replacement UI remain in their scheduled tasks. |
| TECH-014, UX-003–007, NFR-005/006, DEC-011/015 | P00-T06 pins shadcn React Aria `aria-nova`/`nova`, locally reviewed Dialog/Sheet/RadioGroup source, a native file/drop fallback, responsive tokens and a PWA `generateSW` skeleton. Chromium 320 portrait and 390 landscape checks, dialog focus retention, Sheet focus return and axe harness scan pass. Details are in `docs/benchmarks/mobile-ui-platform-spike.md`. | Closes the mobile UI/platform spike for P01-T01, P02-T02, P05-T01 and P05-T02. Physical-device address-bar/keyboard behavior and production PWA update/offline lifecycle remain deferred to P05. |

## Traceability

`AC` means acceptance criteria of the corresponding task; exact checks are listed in the task and `codex-spec/testing-and-quality.md`.

| Requirements | Canonical specification | Tasks | Acceptance / test |
|---|---|---|---|
| PRD-001, TECH-001, TECH-013, TECH-016, DEC-020 | `codex-spec/project-source-of-truth.md`, `codex-spec/architecture/system-architecture.md`, `codex-spec/architecture/data-and-state.md` | P00-T01, P01-T01, P01-T02 | Build SPA; canonical Document contracts/schema; route smoke; no backend runtime |
| PRD-002, TECH-003, TECH-009 | F01, `codex-spec/architecture/system-architecture.md`, `codex-spec/architecture/data-and-state.md` | P01-T03, P02-T01, P02-T02 | Import/cancel/forced failure integration + E2E |
| PRD-003, UX-001 | F01, `codex-spec/design/screens-and-user-flows.md` | P01-T04, P04-T01 | Reloaded library; title/progress/sort/focus tests |
| PRD-004, TECH-004, TECH-006 | F02 | P00-T02, P02-T01 | Corpus snapshots/invariants; footnote/code/table fixtures |
| PRD-005, UX-002 | F04, `codex-spec/design/screens-and-user-flows.md` | P03-T01 | TOC hierarchy + hash jump in both modes |
| PRD-006, TECH-011 | F03 | P00-T04, P03-T02 | Bounded DOM, no sustained gaps/jumps, full reachability |
| PRD-007, PRD-009 | F04 | P03-T03 | Section count/pager/layout strategies |
| PRD-008 | F04, `codex-spec/architecture/data-and-state.md` | P00-T02, P03-T03 | Measured threshold; modeOrigin auto/user tests |
| PRD-010, TECH-007 | F02 | P00-T02, P02-T01 | Property tests: no loss/duplication/reorder/split-node |
| PRD-011, TECH-012 | F04, `codex-spec/architecture/data-and-state.md` | P00-T05, P03-T04 | Reload/mode/strategy anchor tolerance tests |
| PRD-012, PRD-013 | F05 | P00-T05, P02-T03, P04-T02 | Exact duplicate and replace/separate/cancel E2E plus update-pair confidence corpus |
| PRD-014, UX-004 | F05, `codex-spec/design/screens-and-user-flows.md` | P04-T01 | Confirm/delete transaction/focus/error tests |
| PRD-015, TECH-015, NFR-008 | F06 | P05-T02 | Installed offline E2E and update gating |
| PRD-016, TECH-014 | `codex-spec/design/ui-design-system.md`, F06 | P05-T01 | No-flash theme; two-theme visual/a11y checks |
| PRD-017, UX-008 | F02, F06 | P02-T01, P03-T03, P05-T03 | URL policy/security corpus/offline media states |
| PRD-018 | `codex-spec/project-source-of-truth.md`, `AGENTS.md` | All | Dependency/routes review: excluded features absent |
| TECH-002, TECH-008, TECH-010 | `codex-spec/architecture/system-architecture.md`, `codex-spec/architecture/data-and-state.md` | P01-T02, P00-T03 | Import-boundary lint/tests; migration/rebuild tests |
| TECH-005, NFR-003, NFR-004 | F02, `codex-spec/architecture/system-architecture.md` | P00-T02, P02-T01, P05-T04 | Malicious corpus + CSP + network/log audit |
| UX-003, UX-006 | `codex-spec/design/screens-and-user-flows.md`, F01 | P02-T02, P05-T03 | State-machine component tests; actionable errors |
| UX-005, UX-007, NFR-005 | `codex-spec/design/ui-design-system.md`, `codex-spec/design/screens-and-user-flows.md` | P00-T06, P03-T04, P05-T01, P05-T04 | 320/zoom/keyboard/NVDA/VoiceOver/axe matrix |
| NFR-001, NFR-006 | F00, `codex-spec/testing-and-quality.md` | P00-T02, P00-T04, P00-T05, P00-T06 | Stored benchmark reports and browser/device gate |
| NFR-002, NFR-007 | F01, F06, `codex-spec/architecture/data-and-state.md` | P00-T03, P05-T03 | Termination/quota/reprocess recovery tests |
| NFR-009 | `codex-spec/design/ui-design-system.md`, `codex-spec/design/screens-and-user-flows.md` | P01-T01, P05-T01 | String catalog/Intl/long-Russian-copy checks |
| NFR-010 | `codex-spec/testing-and-quality.md`, `codex-spec/implementation-roadmap.md`, tasks | P05-T05 | All required commands green; final checklist signed |
