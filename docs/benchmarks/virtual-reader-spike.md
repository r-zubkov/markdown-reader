# P00-T04 continuous virtual reader spike

Status: **complete for the DEC-022 Chromium-only MVP matrix**.

Measured on 2026-09-09 in the Windows Codex sandbox with Node 24.20.0, pnpm 11.25.0, Playwright 1.62.1 and Chromium 151.0.7922.34. Browser binaries are local Playwright test assets and are not committed. Firefox, Safari/WebKit and iOS are outside the MVP support and release-test matrix by DEC-022.

## Prototype and corpus

The diagnostic route is `/spikes/virtual-reader?count=20000`. It renders a deterministic, indexed corpus without retaining all content in React state:

- 20,000 stable keys in the form `virtual-spike-v1:<ordinal>`;
- seven block shapes: heading, paragraph, list, code, table, media and huge block;
- variable text length, deliberately incorrect 1 px and 720 px estimates, and huge first/last/periodic blocks;
- first, middle and last no-loss markers;
- focusable controls every 47 chunks;
- a controlled late image above the semantic viewport anchor;
- local table/code overflow at a 320 px viewport.

`BoundedChunkWindow` is the repository-like range/cache boundary. It materializes only requested items, uses LRU-style eviction, and protects the currently focused ordinal. The cache hard limit is 96 chunks. This is a spike adapter, not the production repository port.

## Selected configuration

The passing candidate is TanStack React Virtual 3.14.11 (`@tanstack/virtual-core` 3.17.9) behind a document-scroll harness:

| Option | Selected value | Reason |
|---|---:|---|
| Adapter | `useWindowVirtualizer` | Document/window scroll passed Chromium and retains the DEC-015 composition. |
| `count` | 20,000 stress fixture | Covers the upper spike corpus requirement. |
| `overscan` | 8 chunks each side | Observed maximum was 23 mounted chunk wrappers; no 100 ms blank-gap violation. |
| Cache hard limit | 96 chunks | Rapid alternating jumps reached the cap without retaining the corpus. |
| Mounted chunk budget | 48 | Twice the observed maximum, leaving room for production wrapper variance and one focus pin. |
| `estimateSize` | Deterministic per block kind; minimum 1 px | Dynamic measurement recovered from intentionally poor estimates. Production estimates must come from chunk metadata/cost. |
| `measureElement` | Actual `getBoundingClientRect().height`, estimate fallback only for zero-layout tests | Supports dynamic content and ResizeObserver remeasurement. |
| `getItemKey` | Stable version/ordinal-shaped key | Prevents identity loss across range changes. Production key remains `versionId:ordinal`. |
| `scrollMargin` | Measured article offset | Required by the window adapter. |
| `scrollPaddingStart` | 72 px | Keeps aligned targets below the desktop sticky diagnostic toolbar. |
| `rangeExtractor` | Default range plus at most one sorted focus pin | Focus remained attached and active while the viewport moved from first to last. |
| `useFlushSync` | `false` | The current official React adapter documentation calls this out for React 19; enabled comparison did not improve drift, range or gaps. |
| `directDomUpdates` | `false` | The enabled comparison passed but gave no gate benefit and adds direct DOM ownership requirements. It remains an opt-in rerun candidate if production profiling demonstrates a need. |

Dependency responsibility is only virtual range calculation and dynamic measurement. Version 3.14.11 declares React/React DOM 19 compatibility and is MIT licensed. Sources: [React adapter API](https://tanstack.com/virtual/latest/docs/framework/react/react-virtual), [Virtualizer API](https://tanstack.com/virtual/latest/docs/api/virtualizer), [window example](https://tanstack.com/virtual/latest/docs/framework/react/examples/window), [package metadata](https://www.npmjs.com/package/@tanstack/react-virtual).

## Proposed budgets and tolerances

These measured values are the P00-T04 inputs for P01-T04/P03-T02, not release SLAs:

- mounted chunk wrappers: at most 48, including a disjoint focus pin;
- in-memory rendered chunk cache: at most 96;
- stabilized target/semantic-anchor drift after far jump or remeasurement: at most 96 CSS px;
- longest continuously uncovered reading line during rapid alternating jumps: at most 100 ms;
- one main-thread task in the sequential desktop harness: at most 150 ms; investigate aggregate long tasks separately in production profiling;
- no page-level horizontal overflow at 320 CSS px; table/code own their overflow.

The 96 px anchor tolerance deliberately permits roughly three reader lines while semantic position calibration remains owned by P00-T05. The prototype's repeated correction runs for at most six animation frames, pins its anchor during the change, then releases the pin.

## Results

### Deterministic and component evidence

- Unit/component suite: 4 tests passed.
- 20,000-chunk generator/range benchmark: 63.38 ms in the recorded targeted run, seven block kinds, cache count 96.
- First range component render remained under the 48/96 budgets and focus pin state was observable.

### Sequential browser evidence

| Engine/configuration | Max mounted chunks | Max cache | Max reader descendant elements sampled | Max stabilized drift | Longest measured blank gap | Longest PerformanceObserver task |
|---|---:|---:|---:|---:|---:|---:|
| Chromium, selected (`flushSync=false`, direct DOM off) | 23 | 96 | 128 | 0.50 px | 16.70 ms | 64 ms |
| Chromium, `flushSync=true` comparison | 22 | 32 in far-jump scenario | 120 | 0.25 px | no sustained gap observed | 65 ms |
| Chromium, direct DOM comparison | 23 | 34 in far-jump scenario | 120 | 0.38 px | no sustained gap observed | 77 ms |

All required Chromium scenarios reached first/middle/last markers, performed non-linear far jumps, survived rapid forward/reverse scroll, preserved focused content, remeasured after theme/width/late-image changes, and had no page overflow at 320 px. The matrix also exercised a 844x390 landscape viewport.

The full eight-worker matrix produced Chromium startup tasks up to 232 ms; the sequential run reduced the maximum to 66 ms. This indicates shared sandbox/process startup contention, so only the sequential figure is used for the provisional desktop harness budget. Production profiling must separate navigation startup from interaction tasks.

### Runner and excluded-browser notes

- A historical exploratory Firefox 153.0 run could not create a content page with its normal content sandbox in this Windows runner. It passed the Reader scenarios only with runner-specific sandbox-disabling environment flags. DEC-022 now excludes Firefox, so these results are diagnostic only and no Firefox workaround is part of application or Playwright configuration.
- A historical non-gating WebKit run passed the Reader scenarios but its P00-T03 storage smoke failed while preparing a Blob for IndexedDB. DEC-022 excludes WebKit/Safari, so that engine-specific result is diagnostic only and is not a release claim.

With the supported matrix green, P00-T04 is complete and unblocks P01-T04/P03-T02.

## Verification record

Passing checks:

- `pnpm typecheck` (passed);
- `pnpm lint` (passed);
- `pnpm test` (5 files, 33 tests passed);
- `pnpm test:security` (1 file, 3 tests passed);
- `pnpm test:bench` (2 files, 3 tests passed);
- `pnpm build` (passed; 83 modules transformed);
- `vitest run src/features/reader-spike/virtual-reader-spike.test.tsx --reporter verbose` (4 passed);
- `vitest run --config vitest.bench.config.ts src/test/bench/virtual-reader-spike.bench.test.ts --reporter verbose --silent=false` (1 passed);
- Playwright Chromium selected/comparison suite, sequential (5 passed);
- `pnpm test:e2e:list` (7 Chromium tests);
- separately started Vite plus `PLAYWRIGHT_BROWSERS_PATH=.ms-playwright` and `pnpm test:e2e:all` (7 passed).

Historical excluded-engine diagnostics: Firefox Reader and Blob round trips passed only with runner-specific launch flags; WebKit's storage smoke preserved the underlying message `Error preparing Blob/File data to be stored in object store`. Chromium passes both in the supported matrix.

## Fallback

If a supported target exceeds the budgets after a dependency or production-shape change, retain the same bounded cache and stable semantic keys but reject the current adapter configuration. The fallback order is a bounded manual window with explicit anchor compensation, then sections mode for affected documents/platforms. Neither fallback may truncate content or turn `whole` into a giant DOM.
