# P02-T01 production Markdown pipeline report

Task: `P02-T01 Production Markdown pipeline`.

Date: 2026-09-11.

## Outcome

The P00 prototype is now the production worker pipeline. It performs byte validation, fatal UTF-8 decoding, SHA-256 hashing, CommonMark/GFM parsing, deterministic heading/outline and block-anchor generation, whole-node chunking, complete-document HAST conversion, URL/resource policy, bounded highlighting, final allowlist sanitization, serialization and measured batching.

Complete-document MDAST-to-HAST conversion is deliberate: reference definitions and footnotes can cross internal chunk boundaries without lost targets, duplicated footnote bodies or duplicated DOM IDs. The resulting HAST is partitioned by trusted source positions, then each chunk is transformed, sanitized and serialized independently. No AST or DOM node crosses the worker boundary or enters persistence.

`PIPELINE_VERSION` is `4`. Version 4 retains the version-3 SHA-256 `contentFingerprint` contract and changes persisted derived output for cross-chunk references/footnotes, internal heading links, bounded titles and `whole` layout safety. `WORKER_PROTOCOL_VERSION` is `2`; request, metadata, batches and terminal summaries now carry enough version/count/byte evidence to fail closed on stale, missing or altered messages.

No dependency was added.

## Production limits

The central values in `src/domain/content/pipeline-limits.ts` are:

| Limit | Value | Production behavior |
|---|---:|---|
| `maxFileBytes` | 1,250,000 | Reject from `File.size` before `arrayBuffer()`, then enforce again on authoritative bytes. |
| `maxAstNodes` | 100,000 | Abort with `PIPELINE_LIMIT`; protects traversal/metadata growth under the byte cap. |
| `maxAstDepth` | 128 | Abort with `PIPELINE_LIMIT`; traversal is iterative. |
| `maxTopLevelBlocks` | 20,000 | Abort with `PIPELINE_LIMIT`; exact at/above regression is measured. |
| `maxTitleChars` | 240 | Bound derived display metadata and emit `TITLE_TRUNCATED`; rendered heading/body stays complete. |
| `targetChunkCost` | 8,000 | Soft boundary between whole top-level nodes. |
| `maxChunkCostBeforeFallback` | 24,000 | Layout/chunk safety budget. |
| `oversizedNodeCost` | 32,000 | Keep one indivisible node intact and flag safe fallback. |
| `maxCodeHighlightChars` | 8,000 | Preserve larger code as escaped plain code. |
| `maxAutoDetectChars` | 1,200 | Do not auto-detect above this size. |
| `autoDetectMinRelevance` | 8 | Low-confidence unlabeled code remains plain. |
| `safeDataImageBytes` | 4,096 | Allow only small raster data images; SVG data stays blocked. |
| `batchMaxChunks` | 8 | Maximum chunks per worker/repository batch. |
| `batchMaxHtmlBytes` | 64,000 | Maximum aggregate UTF-8 HTML bytes; one indivisible larger chunk is the only exception. |

The 20,000-top-level-block boundary used a 328,888-byte generated document and completed in 1,925.98 ms in the Node benchmark; 20,001 blocks failed with the exact stable limit name/value/actual tuple. Reduced injected-limit property tests exercise AST-node and AST-depth boundary failures without weakening production constants. File-size below/at/above fixtures and oversized node/code plus batch-boundary behavior remain covered by the deterministic corpus.

## Markdown, IDs and layouts

- CommonMark plus GFM tables, task lists, autolinks, strikethrough and footnotes are supported.
- Title is the bounded plain text of the first H1, otherwise the bounded filename stem.
- H1-H3 outline IDs use deterministic `mdr-h-*` values; repeated headings remain unique. User-authored local heading fragments are rewritten to generated IDs when resolvable and blocked otherwise.
- Every top-level source block receives ordered source ranges, a stable within-version block ID and the version-3 lowercase SHA-256 content fingerprint over block type plus normalized-line-ending exact source.
- `auto`, `h1`, `h2`, `h3` and `whole` layouts cover all chunk ordinals without gaps. `whole` is safe when its bounded chunks are safe; total document cost no longer incorrectly disables the logical whole-document layout.
- Russian footnote label/back-reference strings are emitted before sanitize and verified across repeated references in different chunks.

## Highlight policy

Explicit grammars are `bash`, `c`, `cpp`, `csharp`, `css`, `diff`, `go`, `graphql`, `ini`, `java`, `javascript`, `json`, `kotlin`, `less`, `lua`, `makefile`, `markdown`, `objectivec`, `perl`, `php`, `plaintext`, `python`, `r`, `ruby`, `rust`, `scss`, `shell`, `sql`, `swift`, `typescript`, `wasm`, `xml` and `yaml`.

Aliases remain the P00 set: JavaScript/TypeScript/shell/markup/Markdown/Python/YAML/C++/C#/Rust/Ruby/Kotlin/GraphQL/Make/plaintext/SCSS/Objective-C/Perl/INI variants are normalized only to registered grammar names. Unknown explicit labels produce escaped `language-plaintext`, `UNSUPPORTED_LANGUAGE` and a safe-fallback diagnostic. Oversized code produces `CODE_HIGHLIGHT_SKIPPED`; a grammar exception produces `HIGHLIGHT_FAILED`. Unlabeled code is auto-detected only below 1,200 characters and relevance 8. The measured ambiguous sample scored 1 and the JavaScript sample scored 6, so both correctly remained plain; the slower sample took 70.09 ms.

## Security and fallback policy

- Raw HTML is rendered as inert literal text; `rehype-raw` is absent.
- Link policy permits generated internal hashes, HTTP(S) and mailto. External HTTP(S) receives `_blank` plus `noopener noreferrer`; unresolved/unsafe/control-character protocols lose `href` and emit a warning.
- Images permit HTTPS and bounded raster data URLs only. Relative, HTTP, file/blob and SVG data sources become a semantic placeholder that retains safe alt text.
- Lowlight runs before the final narrow `rehype-sanitize` schema. No transformation runs after sanitize; only stringify follows.
- Generated IDs must use `mdr-*`; source `id`, `name`, `style`, event attributes and executable/embed elements cannot survive.
- Fatal structural uncertainty returns `PIPELINE_FAILED` or named `PIPELINE_LIMIT`; it never publishes partial output.
- The repository accepts only current-pipeline batches with valid SHA-256 fingerprints/ranges and brands HTML only for the complete current ready version. Stale HTML cannot render. The rebuild port reads the preserved source Blob without branding stale derived HTML and stages a current version under an expected-current-version precondition.

## Regression evidence

The visible production benchmark rerun on Node `v24.20.0`, pnpm `11.25.0`, Vitest `4.1.11` measured:

| Fixture | Bytes | Blocks | Chunks | Batches | HTML bytes | Total ms |
|---|---:|---:|---:|---:|---:|---:|
| `small` | 475 | 10 | 4 | 1 | 1,578 | 21.72 |
| `medium` | 29,206 | 203 | 49 | 7 | 41,304 | 48.58 |
| `large` | 143,194 | 935 | 181 | 23 | 198,417 | 194.99 |
| `long-code` | 9,248 | 2 | 2 | 1 | 9,338 | 2.69 |
| `wide-table` | 1,942 | 2 | 1 | 1 | 3,490 | 5.61 |
| `huge-single-node` | 34,410 | 2 | 2 | 1 | 34,465 | 21.25 |

Deterministic property tests use 24 fixed seeds and verify marker order, anchor order, identical metadata/chunks and complete layouts. Semantic tests verify all explicit grammars/aliases, cross-chunk footnotes, internal links, title bounds, structural limits, oversized/unknown code and all strategies. The malicious DOM/URL/image suite passes. Chromium E2E imports the supported semantic/security corpus through the real Worker, and real IndexedDB E2E blocks a stale version then rebuilds atomically from its source Blob.

## Residual risks and downstream work

The 1.25 MB file limit remains deliberately conservative; increasing it requires supported-Chromium memory and long-task evidence. Auto-detect is intentionally conservative and may leave valid unlabeled code plain. Remote-image preference enforcement belongs to the Reader/platform tasks; the persisted pipeline only establishes the safe resource shape. Duplicate/update decisions and complete import UI remain `P02-T02`/`P02-T03`; semantic progress mapping across changed source remains `P04-T02`.
