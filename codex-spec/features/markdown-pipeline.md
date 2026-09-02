# F02. Safe Markdown pipeline

## User value

Render the complete technical document with predictable Markdown semantics and code highlighting while treating every byte/URL as untrusted. Related: PRD-004, PRD-010, PRD-017, TECH-003, TECH-004, TECH-005, TECH-006, TECH-007, NFR-001, NFR-003, NFR-004.

## Scope / non-goals

Decode UTF-8, SHA-256, CommonMark + GFM parse, title/outline/anchors, internal partitioning, layouts, raw-HTML inert handling, URL policy, sanitize, lowlight, serialization, batch output and safe fallback.

Non-goals: MDX, executable/raw allowed HTML, Mermaid, math, custom plugins, full-text index, main-thread parsing or persisting full AST.

## Pipeline order

1. Enforce raw byte limit; fatal UTF-8 decode.
2. SHA-256 raw bytes.
3. `unified` + `remark-parse` + `remark-gfm` to MDAST with positions.
4. Normalize title and generate deterministic heading IDs/path keys/outline.
5. Transform raw HTML nodes to literal escaped text nodes.
6. Derive top-level block metadata and semantic anchors.
7. Partition whole top-level nodes into internal chunks; derive layouts.
8. Convert each chunk to HAST via `remark-rehype`, with Russian footnote/back labels and fixed clobber prefix.
9. Apply URL/image/resource policy; unknown/blocked resource becomes semantic fallback node.
10. Highlight eligible code in HAST with registered grammars and size/time policy; failure leaves escaped code.
11. Apply strict `rehype-sanitize` schema to final HAST.
12. Serialize safe HAST to HTML, attach pipeline version and batch by measured budget.

Sanitization must follow every transformation capable of adding nodes/attributes. No post-sanitize plugin may introduce untrusted markup.

## Partition invariants

- Input top-level nodes map to output exactly once, in order.
- Boundary exists only between nodes. H1/H2 are preferred hard boundaries before heading; cost budget adds soft boundary.
- Oversized single node becomes one flagged chunk and uses type-specific safe fallback/limited highlight; never split source invisibly or truncate.
- `auto`: H1 groups, then H2 for oversized groups, then safe soft boundaries.
- `h1`/`h2`: navigation boundaries follow headings where present; oversized logical sections still contain internal chunks.
- `whole`: one logical section over all chunks; `safeForSelection` is measured policy.
- No headings: auto uses cost boundaries; outline empty; sections retain deterministic titles/count.

## Content/security policy

Minimum semantic schema supports paragraphs, `h1–h6`, emphasis/strong/delete, lists/task lists, blockquote, links, images/fallback, `pre/code`, table structure, footnote `section/sup`, horizontal rule and required safe classes/ARIA/data attributes.

- Drop all source `style`, `on*`, `id`, `name`, `srcdoc` and embedding/executable elements.
- Only generated ID prefix is allowed; sanitize schema and footnote links agree.
- Link protocols: internal hash, HTTP(S), mailto. External HTTP(S) gets new-tab/noopener/noreferrer. Block dangerous/unknown.
- Image: relative/http/blob/file/SVG-data blocked into placeholder. HTTPS obeys global preference at render/policy layer, `no-referrer`, lazy; safe raster data obeys measured decoded-size cap.
- Language label is normalized against explicit alias map; never becomes arbitrary class. Unknown language plain code. Auto-detection runs only below measured code-size limit and confidence threshold from DFR-002.
- Plain fallback must escape source and retain visible information; no silent omission unless element is purely dangerous executable markup, which is represented by safe literal/notice according to corpus decision.

## Output contract

Metadata contains content hash, byte/char length, title, outline, layouts, chunk count, warnings summary. Chunk contains source range, cost, heading IDs, block anchors, safe HTML string, render state/diagnostic. Worker never sends DOM nodes.

## Error strategy

- Fatal integrity/security uncertainty aborts import.
- Highlight grammar failure/code too large → safe plain code and warning.
- Unsupported local image/raw HTML → literal/fallback while rest continues.
- Malformed Markdown follows deterministic parser behavior; marker/invariant tests ensure no content disappears unexpectedly.
- AST/node/time limits fail with stable `PIPELINE_LIMIT` or flagged fallback according to central policy.

## Acceptance criteria

- [ ] CommonMark/GFM fixture renders headings, links, tables, task lists, footnotes and fenced code semantics.
- [ ] Property/corpus tests prove marker coverage, order, no duplicates and no mid-node split.
- [ ] Malicious corpus has no executable tags/events/styles, unsafe protocols or user-controlled clobbering IDs after serialization/DOM parse.
- [ ] Unknown/failed/oversized highlighting remains readable escaped code.
- [ ] All strategies cover entire chunk ordinal range; `whole` does not bypass internal chunking.
- [ ] Output is deterministic for same bytes + pipeline version.
- [ ] Main thread remains responsive under measured corpus because pipeline executes in worker.

## Required tests

Golden semantic fixtures (assert HAST/DOM roles, not brittle full snapshots), property/fuzz partition tests, URL matrix, malicious corpus DOM assertions, repeated-heading/footnote i18n tests, worker protocol/batch tests, deterministic hash/output test, performance spike regression at thresholds.

## Dependencies

P00-T02 and central `PipelineLimits`. Repository F01 persists outputs; F03/F04 render only validated current-pipeline chunks.
