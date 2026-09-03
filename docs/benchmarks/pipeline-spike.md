# P00-T02 pipeline spike report

Task: `P00-T02 Content pipeline and limits spike`.

Date: 2026-09-02. Revised: 2026-09-03.

## Environment

- OS probe: `Microsoft Windows NT 10.0.26200.0` from `[System.Environment]::OSVersion.VersionString`.
- Node: `v24.20.0`.
- Package manager: `pnpm@11.25.0` through Corepack with `COREPACK_HOME=.corepack`.
- Test runners: Vitest `4.1.11`; default/security suites use jsdom, bench suite uses Node.
- Browser memory, browser Long Tasks API and physical iPhone Safari were not measured in this task. Bench evidence below is a worker-compatible wall-time/output proxy and must not be treated as release performance acceptance.

## Added dependencies

All new direct dependencies are MIT-licensed package metadata from installed `node_modules`.

| Package | Version | Responsibility |
|---|---:|---|
| `unified` | `11.0.5` | Processor foundation for mdast/hast pipeline. |
| `remark-parse` | `11.0.0` | CommonMark mdast parse with source positions. |
| `remark-gfm` | `4.0.1` | GFM tables, task lists, autolinks, strikethrough and footnotes. |
| `remark-rehype` | `11.1.2` | mdast to HAST conversion with Russian footnote labels and clobber prefix. |
| `rehype-sanitize` | `6.0.0` | Final allowlist sanitizer boundary. |
| `rehype-stringify` | `10.0.1` | HAST serialization to persisted HTML strings. |
| `lowlight` | `3.3.0` | HAST syntax highlighting with highlight.js `11.11.2` transitively. |
| `mdast-util-to-string` | `4.0.0` | Plain heading text extraction. |
| `unist-util-visit` | `5.1.0` | mdast heading traversal. |
| `@types/mdast` | `4.0.4` | Type-only mdast contracts. |
| `@types/hast` | `3.0.5` | Type-only HAST contracts. |

Compatibility: these packages are ESM-only and their published Node floors are below the project runtime floor `>=22.22.0`.

## Prototype summary

- Raw bytes are rejected above `maxFileBytes`, then decoded by fatal UTF-8 `TextDecoder`, then hashed with WebCrypto SHA-256 over the full byte buffer.
- Markdown parse uses `unified + remark-parse + remark-gfm`.
- Heading IDs use generated `mdr-h-*` IDs; outline contains H1-H3 with deterministic path keys and child IDs.
- Raw mdast `html` nodes are converted to literal text before HAST conversion; `rehype-raw` is not used.
- Internal chunks are built only between top-level mdast nodes; oversized single nodes are flagged, not split or truncated.
- HAST conversion uses `remark-rehype` with Russian footnote labels and `mdr-fn-*` clobber prefix.
- URL/image policy runs before highlighting and final sanitize. Unsafe link URLs lose `href`; unsupported images become `.mdr-image-placeholder`.
- `lowlight` runs before sanitize. Unknown, low-confidence, failed or oversized code remains escaped plain code.
- Final sanitize uses a narrow custom `rehype-sanitize` schema, not the broader default GitHub-like schema. Allowed IDs must match `mdr-*`; `style`, `on*`, `name`, executable/embed tags and unsafe protocols are not allowed.
- Worker compatibility is type-checked by importing the shared pipeline limits/types from `src/workers/bootstrap-typecheck.ts`.

## Corpus

Generated fixtures live in `src/test/corpus/pipeline-corpus.ts`. Every fixture records UTF-8 byte length, top-level mdast node count and ordered `[[MDR:...]]` markers.

Coverage includes:

- `small`: H1-H3, links, emphasis, task list, table, TypeScript code fence and footnote.
- `medium` and `large`: deterministic generated headings, prose, links, code and tables.
- `no-headings`: cost-based fallback layout.
- `repeated-unicode-headings`: repeated Cyrillic headings and NFKC accent normalization.
- `long-code`, `single-long-line`, `wide-table`, `huge-single-node`: fallback candidates.
- `malicious`: raw script/style/iframe/object, event/style/name/clobbering attributes, dangerous/encoded protocols, relative/http/SVG data images, safe HTTPS image and small raster data image.
- `byte-limit-below`, `byte-limit-at`, `byte-limit-above`: boundary fixtures generated against supplied limits.

## Measurements

Command used for visible measurements:

```powershell
$env:COREPACK_HOME = "$PWD\.corepack"; corepack pnpm exec vitest run --config vitest.bench.config.ts --reporter verbose --silent=false
```

| Fixture | Bytes | Top-level nodes | Chunks | Batches | HTML bytes | Warnings | Wall time ms | Timer-delay proxy ms |
|---|---:|---:|---:|---:|---:|---|---:|---:|
| `small` | 475 | 10 | 4 | 1 | 1,571 | none | 22.99 | 3.26 |
| `medium` | 29,206 | 203 | 49 | 7 | 41,256 | none | 47.33 | 47.39 |
| `large` | 143,194 | 935 | 181 | 23 | 198,237 | none | 187.29 | 187.38 |
| `long-code` | 9,248 | 2 | 2 | 1 | 9,337 | `CODE_HIGHLIGHT_SKIPPED` | 6.13 | 3.32 |
| `wide-table` | 1,942 | 2 | 1 | 1 | 3,490 | none | 5.66 | 5.72 |
| `huge-single-node` | 34,410 | 2 | 2 | 1 | 34,464 | `OVERSIZED_NODE` | 32.92 | 0.56 |

Stage timings from the same run:

| Fixture | Decode | Hash | Parse | Metadata | Partition | Render/sanitize/stringify | Layout | Batch | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `small` | 0.04 | 3.52 | 1.83 | 2.48 | 0.18 | 14.26 | 0.40 | 0.06 | 22.82 |
| `medium` | 0.02 | 0.21 | 31.30 | 4.26 | 0.15 | 10.68 | 0.44 | 0.22 | 47.29 |
| `large` | 0.08 | 0.59 | 149.27 | 15.11 | 0.48 | 20.72 | 0.61 | 0.32 | 187.18 |
| `long-code` | 0.02 | 3.33 | 2.23 | 0.14 | 0.03 | 0.25 | 0.03 | 0.02 | 6.06 |
| `wide-table` | 0.02 | 0.10 | 3.46 | 1.22 | 0.01 | 0.79 | 0.03 | 0.01 | 5.64 |
| `huge-single-node` | 0.02 | 0.50 | 31.86 | 0.16 | 0.05 | 0.22 | 0.03 | 0.04 | 32.87 |

Auto-detect preview:

| Sample | Accepted | Language | Relevance | Time ms |
|---|---|---|---:|---:|
| Ambiguous prose/list | no | `diff` | 1 | 90.43 |
| Short JavaScript function | no | `javascript` | 6 | 32.63 |

Interpretation: auto-detect stays bounded on this small matrix but became more noticeable with the expanded subset, and it is still not reliable enough for unlabeled code at low relevance. Explicit labels should be preferred. Unlabeled code should remain plain unless a later production corpus proves a confidence threshold with acceptable false positives.

## Proposed P00 limits

Central proposal: `src/domain/content/pipeline-limits.ts`.

| Limit | Value | Behavior |
|---|---:|---|
| `maxFileBytes` | `1_250_000` | Hard reject before decode/hash. Conservative until browser/iPhone memory runs. |
| `targetChunkCost` | `8_000` | Soft partition budget between top-level nodes. |
| `maxChunkCostBeforeFallback` | `24_000` | Section/layout safety budget; oversized sections mark `safeForSelection=false`. |
| `oversizedNodeCost` | `32_000` | Single top-level node remains intact and gets `OVERSIZED_NODE`. |
| `maxCodeHighlightChars` | `8_000` | Larger code stays escaped plain code with warning. |
| `maxAutoDetectChars` | `1_200` | Auto-detect is never attempted above this size. |
| `autoDetectMinRelevance` | `8` | Below threshold stays plain. Current measured snippets did not pass. |
| `safeDataImageBytes` | `4_096` | Small raster `data:image/{png,jpeg,gif,webp,avif}` allowed; SVG data blocked. |
| `batchMaxChunks` | `8` | Worker/repository batch chunk count proposal. |
| `batchMaxHtmlBytes` | `64_000` | Worker/repository batch HTML byte proposal; a single larger chunk is allowed as fallback. |

These are not final release thresholds. P02-T01 should rerun production corpus benchmarks. P00-T04/P00-T06 must still determine DOM window, overscan, browser memory and mobile Safari behavior.

## Grammar recommendation

Core explicit language set for the next implementation task:

`bash`, `c`, `cpp`, `csharp`, `css`, `diff`, `go`, `graphql`, `ini`, `java`, `javascript`, `json`, `kotlin`, `less`, `lua`, `makefile`, `markdown`, `objectivec`, `perl`, `php`, `plaintext`, `python`, `r`, `ruby`, `rust`, `scss`, `shell`, `sql`, `swift`, `typescript`, `wasm`, `xml`, `yaml`.

Aliases currently normalized: `js/jsx/mjs/cjs -> javascript`, `ts/tsx -> typescript`, `sh/zsh -> bash`, `html -> xml`, `md/mdx -> markdown`, `py -> python`, `yml -> yaml`, `c++/cc/cxx/hpp -> cpp`, `c#/cs -> csharp`, `rs -> rust`, `rb -> ruby`, `kt/kts -> kotlin`, `gql -> graphql`, `make/mak/mk -> makefile`, `txt/text -> plaintext`, `sass -> scss`, `objc/obj-c/mm -> objectivec`, `pl/pm -> perl`, `toml/conf -> ini`, `shellsession -> shell`.

Revision on 2026-09-03: `P00_PIPELINE_LIMITS` was renamed to `PIPELINE_LIMITS` because the old task-prefixed name leaked spike bookkeeping into normal code. `PIPELINE_VERSION` was bumped to `2` because the explicit highlight grammar policy changed.

Recommendation for DFR-002: ship explicit-label highlighting first. Keep auto-detect behind `maxAutoDetectChars` and `autoDetectMinRelevance`, and treat it as rejected for unlabeled low/medium-confidence samples until a larger real-world corpus proves otherwise.

## Acceptance evidence

- Marker preservation: default tests assert every expected marker appears exactly once and in order across `small`, `medium`, `no-headings`, `repeated-unicode-headings`, `long-code`, `single-long-line`, `wide-table` and `huge-single-node`.
- No top-level split: default tests assert one block anchor per parsed top-level mdast node.
- Layout coverage: default tests assert `auto`, `h1`, `h2` and `whole` cover the full chunk range without gaps; `whole` remains one logical section over multiple internal chunks.
- Security corpus: security tests assert no executable/embed tags, `on*`, `style`, `name`, non-`mdr-*` IDs, unsafe link protocols, HTTP/relative/SVG data image output.
- Boundary behavior: tests cover invalid UTF-8, below/at/above byte limit, full-buffer SHA-256, oversized code fallback and oversized node fallback.

## DFR updates

- `DFR-001`: partially informed by this task for file bytes, chunk cost, oversized-node/code fallback and batch shape. Still deferred for DOM window, overscan, browser memory and anchor tolerance until P00-T04/P00-T05/P00-T06.
- `DFR-002`: initial grammar set and auto-detect policy are now proposed. Final acceptance should occur in P02-T01 after production corpus rerun.

## Unblocked

- `P00-T05` can start using deterministic corpus markers and heading/path/block anchors from this spike.
- `P02-T01` has a prototype pipeline and tests to harden, but it should not treat P00 limits as final release thresholds.
