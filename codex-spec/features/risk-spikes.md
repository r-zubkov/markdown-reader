# F00. Mandatory risk spikes

## Value and scope

Spikes prevent Codex from turning unknown performance/platform limits into invented constants. They produce committed fixtures, reports and decisions used by implementation tasks. Related: NFR-001, NFR-002, NFR-005, NFR-006, DEC-008, DFR-001, DFR-002.

Non-goal: throwaway UI demos with no reproducible measurements. Spike code may be discarded only after its corpus/report/tests have been transferred to production tasks.

## Shared corpus

Create synthetic and user-safe fixtures; do not commit copyrighted full documents without permission.

- `small`: headings, paragraphs, lists, links, footnotes, task list, code/table.
- `medium/large`: generated structure with deterministic seed and recorded block/source counts.
- `no-headings`, repeated headings, Unicode/Russian titles, malformed-but-parseable Markdown.
- `long-code`, `single-long-line`, `wide-table`, `huge-single-node`, remote/data/relative images.
- `malicious`: raw script/style/iframe/object, event attributes, clobbering IDs/names, dangerous/encoded protocols, malformed URLs, SVG data.
- `update-pairs`: same bytes/different name; same name/small edits; moved/renamed headings; radically changed structure.

Every generated fixture records expected byte length, top-level node count and marker sequence so loss/duplication can be asserted.

## Spike A — pipeline and limits

**Tasks:** P00-T02. Process corpus in worker-like environment; measure wall time, peak/estimated memory where available, long main-thread tasks, hash/decode/parse/sanitize/highlight cost, batch size and output size.

Prove:

- every expected marker occurs once, order preserved, no top-level node split;
- sanitizer/URL policy security corpus passes;
- invalid UTF-8 and above-limit input fail closed;
- huge code/table/node takes bounded fallback, not silent truncation;
- core highlight language candidates and auto-detection false-positive/cost evidence are recorded.

Output: `docs/benchmarks/pipeline-spike.md` or repository-equivalent, `PipelineLimits` proposal, DFR-001/002 decision update. Do not assert precise peak memory if browser API cannot measure it; document method/proxy.

## Spike B — IndexedDB atomicity

**Tasks:** P00-T03. Implement minimal Dexie schema/prototype and simulate cancellation, worker termination, reload between batches, quota error, duplicate batch, missing batch, migration and stale replace conflict.

Gate:

- visible Documents always reference complete ready versions;
- current ready version survives every pre-commit failure;
- abandoned staging cleanup is scoped/idempotent;
- commit rejects invalid count/ranges/current-version precondition;
- raw Blob survives derived rebuild/migration path.

Output: schema/transaction decision report and reusable integration tests with `fake-indexeddb` plus browser confirmation.

## Spike C — continuous virtualization

**Tasks:** P00-T04. Render 5k–20k heterogeneous chunks via window/document scroll and real measured heights. Test initial restore, far jump, reverse scroll, font/theme/width change, late images, focus inside chunk and rapid scroll.

Compare at least:

1. TanStack Virtual window adapter with documented dynamic `measureElement` and stable keys;
2. `useFlushSync` behavior required by current React/TanStack versions;
3. `directDomUpdates` only if standard mode fails measured budget;
4. bounded manual window/sections fallback if library approach fails.

Record browser/device, DOM node/window count, sustained blank gap/jump observations, main-thread long tasks and anchor drift. Gate must define measurable tolerance before P03-T02; no «выглядит нормально» approval.

## Spike D — semantic progress mapping

**Tasks:** P00-T05. For update pairs and mode/strategy changes, sample anchors at start/middle/end, map them and compare expected heading/block.

Outputs:

- deterministic mapping order and confidence reasons;
- tolerance definition for exact vs approximate;
- cases that intentionally fall back to overall ratio/start;
- UI wording trigger for `approximate`/`none`.

Gate: no mapping result is labeled exact if expected semantic block differs beyond recorded tolerance.

## Spike E — mobile/platform/UI primitives

**Tasks:** P00-T06. On actual iPhone Safari plus automated WebKit test:

- import Sheet/Dialog dynamic content, cancel and focus return;
- TOC Sheet scroll lock, safe area, address-bar/dynamic viewport;
- 320/390 reflow, code/table overflow and 44 px targets;
- background/foreground, `pagehide`, IndexedDB persistence/quota behavior;
- PWA offline/reload/update prompt skeleton;
- shadcn React Aria Dialog/Sheet/RadioGroup state replacement.

Gate: no lost focus/background scroll/cut footer/blocking crash in core scenario. Failed primitive can be replaced locally with direct React Aria implementation under same app contract and decision update.

## Acceptance criteria

- [ ] Each spike has committed reproducible fixtures, procedure, environment and result.
- [ ] Thresholds/configs cite measured evidence and distinguish hard reject, safe fallback and warning.
- [ ] Spikes 1, 3 and 5 pass before MVP status changes from `Requires PoC`.
- [ ] Failed candidate has a documented fallback and follow-up task; roadmap is updated, not silently ignored.

## Tests

Property tests for partition invariants; security corpus; fake-IDB/browser transaction tests; Playwright Chromium/Firefox/WebKit; physical iPhone checklist; benchmark scripts with deterministic seed.

## Dependencies

Only P00-T01 bootstrap. Production import/reader tasks depend on the relevant spike outputs.
