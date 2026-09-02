# Testing and quality

## Quality model

Test depth follows risk: content loss/security/atomicity/progress mapping/virtualization receive algorithmic and browser tests; simple presentational composition receives focused component/accessibility/visual checks. Coverage percentage is diagnostic, not release target.

## Target commands

These are greenfield target scripts that P00-T01 must create. After bootstrap, actual `package.json` is canonical.

| Command | Gate |
|---|---|
| `pnpm typecheck` | Strict TypeScript, worker/DOM builds and contract compatibility |
| `pnpm lint` | ESLint, hooks, accessibility/import-boundary rules |
| `pnpm test` | Vitest unit + component/integration default suite |
| `pnpm test:security` | Malicious Markdown/URL/sanitizer corpus |
| `pnpm test:bench` | Deterministic spike/performance regression scripts; not default unit suite |
| `pnpm test:e2e` | Fast Chromium MVP E2E |
| `pnpm test:e2e:all` | Playwright Chromium/Firefox/WebKit release matrix |
| `pnpm build` | Production Vite/PWA build and type-safe assets |
| `pnpm preview` | Local production-build manual/PWA smoke |

If a tool requires a different exact invocation, bootstrap updates this file and all task Verification sections in the same change.

## Layers

### Typecheck/lint

- No unchecked `any`/casts at File, worker, persisted-record or URL boundary.
- Domain cannot import React/DOM/Dexie; screen cannot import DB tables.
- `dangerouslySetInnerHTML` allowlist contains only `SafeHtmlChunk`.
- React hooks/accessibility rules enabled; source code compiles for main and worker contexts.

### Unit/property

- Heading IDs/path keys, normalization, duplicate/update policy.
- Partition/layout invariants: coverage, order, no duplication, no split, deterministic output.
- URL/image/content policy and code-language alias/limits.
- Semantic anchor observation/mapping/confidence and progress rounding.
- Worker protocol/reducer transition exhaustiveness.
- PWA/storage/theme preference adapters.
- Property/fuzz inputs use deterministic seeds printed on failure.

### Integration/component

- Dexie schema/migrations, stage/append/commit/abort/cleanup/delete/conflict with `fake-indexeddb` plus browser confirmations.
- Import reducer/controller with worker/repository fakes, including stale/late messages.
- Library/Reader screen states, Dialog→decision state replacement, Sheet focus/scroll lock, settings immediate apply.
- SafeHtml repository provenance/pipeline mismatch.
- Virtual window range/focus/remeasure behavior. Do not test core algorithms through rendered snapshots.

### E2E/browser

- Production-like browser IndexedDB/File/Worker/router behavior.
- PWA/offline/update tests use production build in isolated origin/profile and clean service-worker state.
- Each test owns/cleans its test database; no global site-data clear command in application code.
- WebKit automation is necessary but does not replace physical iPhone checklist.

## Risk matrix

| Area | Primary tests | Required failures/edges |
|---|---|---|
| Pipeline/content loss | corpus + property + worker | malformed, no headings, huge node, repeated headings, footnotes |
| XSS/URL/privacy | security corpus + parsed DOM + network assertions | scripts/events/style/clobbering/encoded protocol/SVG data/remote off |
| Atomic storage | repository integration + browser | quota, cancel, crash, reload, missing/duplicate batch, migration, conflict |
| Continuous reader | component + E2E + benchmark + iPhone | 20k variable chunks, reverse/far jump, image/font/theme resize, focus |
| Position mapping | corpus unit + E2E | mode/strategy, small update, moved heading, radical update |
| Lifecycle | integration/E2E | exact duplicate, multiple candidates, replace fail, cleanup fail, delete fail |
| PWA/platform | production E2E + device | offline, update during import, old/new tab, background/pagehide |
| UI/a11y | component/axe/manual/visual | 320/zoom, long Russian copy, dark/code contrast, focus return |

## Corpus and fixtures

F00 defines canonical corpus. Store generated sources or generators, expected marker metadata and update pairs under a non-production test directory. Rules:

- deterministic seed and reproducible byte size;
- no copyrighted full documents without explicit permission;
- malicious cases are isolated and named by threat;
- fixtures at just-below/at/just-above every measured limit;
- sample source markers allow no-loss assertions independent of serialized whitespace;
- database migration fixtures preserve every released schema version.

## Mock/fake/stub rules

- Mock only boundary owned by test: WorkerPort, StorageManager, service-worker registration, clock/observer.
- Domain pipeline/partition/mapping uses real implementation and fixtures, not mocks.
- `fake-indexeddb` is fast integration evidence, not proof of browser transactions/quota; retain browser tests.
- Virtualizer may be replaced by deterministic adapter in screen state tests, but real adapter requires its own component/E2E suite.
- Network is denied by default in reader E2E; explicit image tests allow only controlled HTTPS fixture origin.

## Browser/device matrix

Release tier:

- current stable desktop Chromium/Chrome/Edge behavior via Chromium;
- current stable Firefox;
- current stable Safari behavior via Playwright WebKit plus manual macOS Safari smoke when available;
- current stable mobile Chrome Android smoke;
- physical iPhone Safari core checklist.

Hard CSS floor: Safari 16.4+, Chrome 111+, Firefox 128+. Exact release versions/date/device are recorded in acceptance report. No claim that WebKit automation equals iOS Safari.

## Accessibility checks

- Automated axe on L-01 ready/empty/error; O-01/O-02/O-03/O-04; R-01 continuous/sections/error; both themes where relevant.
- Keyboard-only import, continue, TOC, settings, pager, replace and delete.
- NVDA with Firefox or Chrome; VoiceOver Safari macOS and physical iPhone for Sheet/Reader/Pager.
- Focus not hidden by sticky toolbar; no focus loss on virtual unmount/delete/state replacement.
- Zoom 200/400%, 320 px reflow, text-spacing override, forced colors and reduced motion.
- Dynamic announcements sampled for duplication/spam; scroll progress silent.

## Responsive/visual checks

Viewport representatives: 320, 390, 768, 1024, 1120, 1440 CSS px plus landscape mobile. Check light/dark for library, reader, code/table, all overlays, banners and focus. Screenshot baselines are useful for stable composed states but do not replace semantic assertions.

## Performance evidence

No arbitrary release budget is declared before F00. Spikes must record:

- corpus/environment and measurement method;
- import wall time by stage, main-thread long tasks and browser-observable memory proxy;
- output/IDB size, batch/chunk counts;
- mounted DOM/cached window count;
- scroll blank gaps/jumps/anchor drift;
- hash/full-buffer failure limit and huge-node behavior.

Accepted values are centralized in `PipelineLimits`/reader config and documented with below/at/above regression fixtures. A new dependency/pipeline version reruns relevant benchmarks.

## Manual smoke

1. Fresh profile online: open empty library, import representative document, open/read.
2. TOC far jump; mode/strategy changes; theme changes; code/table horizontal scroll.
3. Close/reload; confirm position. Go offline; reopen and read; remote image placeholder.
4. Exact duplicate; changed replace with mapping notice; separate import; delete cancel/success.
5. Trigger update while import running, then apply after completion.
6. Keyboard path and 320 px/iPhone path; inspect focus/status.

## Definition of Done

A task is done only when its AC and required tests pass and completion report lists evidence. A phase is done only when every task/dependency is complete and gate checks are green. MVP release requires:

- `typecheck`, `lint`, unit/integration, security, all-browser E2E and build green;
- F00 mandatory spikes and current benchmark report;
- physical iPhone/core accessibility manual records;
- no known content-loss, XSS, partial-publication, unrecoverable migration or blocking reader defect;
- final checklist completed with every waiver explicitly approved, scoped and linked.

Failed/flaky required tests block completion. A flaky test must be fixed or quarantined only with owner, reason and replacement evidence; rerunning until green is not evidence.
