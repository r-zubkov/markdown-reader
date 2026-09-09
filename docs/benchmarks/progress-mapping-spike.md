# P00-T05 semantic progress mapping spike report

Task: `P00-T05 Semantic progress mapping spike`.

Date: 2026-09-09.

## Environment and method

- OS: `Microsoft Windows NT 10.0.26200.0`.
- Node: `v24.20.0`.
- Package manager: `pnpm@11.25.0` through Corepack with `COREPACK_HOME=.corepack`.
- Test runner: Vitest `4.1.11`; mapping measurements use the Node benchmark configuration.
- Fixtures are generated strings in `src/test/corpus/progress-mapping-corpus.ts`; they contain no external document content.
- Each update pair is parsed through the real P00 pipeline. The timed mapping loop runs 2,000 deterministic iterations after parsing, then checks confidence, reason and distance from the expected target block.

The measurements describe the fixed synthetic corpus, not a release performance SLA or a claim about arbitrary real-world edits.

## Contract finding

The pre-spike anchor contract could not safely produce cross-version `exact` results. `blockId` deliberately includes version-specific ordinal/source offsets, while heading path plus block ordinal can select a neighboring block after an insertion. Overall source ratio also cannot prove semantic identity.

`BlockAnchor.contentFingerprint` is therefore required. It is lowercase SHA-256 over the top-level block type, a zero separator and the block's exact source with normalized line endings. Cross-version fingerprint mapping is `exact` only when the fingerprint occurs exactly once in both source and target versions. Ambiguous repeated content is not exact. This derived-data contract change bumps `PIPELINE_VERSION` from `2` to `3`; source blobs remain sufficient for rebuild. No dependency was added.

## Selected deterministic mapping order

Same version:

1. `blockId` -> `SAME_VERSION_BLOCK_ID`, exact.
2. heading path plus block ordinal -> `SAME_VERSION_PATH_ORDINAL`, exact.
3. closest block in the same heading or nearest surviving ancestor subtree -> `SAME_VERSION_NEAREST_HEADING`, approximate.
4. clamped overall source ratio -> `OVERALL_SOURCE_RATIO`, approximate.
5. empty target -> `TARGET_EMPTY`, none.

Cross version:

1. unique source/target content fingerprint -> `CROSS_VERSION_CONTENT_FINGERPRINT`, exact.
2. full non-root heading path plus block ordinal -> `CROSS_VERSION_PATH_ORDINAL`, approximate.
3. deepest surviving non-root ancestor plus relative subtree ordinal -> `CROSS_VERSION_ANCESTOR_ORDINAL`, approximate.
4. overall source ratio, only when structural similarity is at least `0.20` -> `OVERALL_SOURCE_RATIO`, approximate.
5. otherwise target start -> `NO_RELIABLE_MATCH`, none; an empty target returns `TARGET_EMPTY` without an anchor.

Structural similarity is the Dice coefficient over unique block fingerprints and non-root heading paths. The root sentinel is not evidence of related content. The mapper sorts usable blocks by stable source/anchor keys, clamps ratios to `[0,1]`, and returns the target version ID and target block ID; it never carries an old block ID into a replacement.

## Confidence and tolerance policy

| Confidence | Required evidence | Corpus tolerance | UI trigger |
|---|---|---:|---|
| `exact` | Same-version stable identity, or a fingerprint unique in both versions | Expected block distance exactly `0`; no ratio-only exact result | No notice or announcement |
| `approximate` | Heading/ancestor position, or ratio with structural similarity `>=0.20` | At most `1` meaningful block from the fixture's expected target; observed maximum was `0` | One announced inline notice with Continue and Start actions |
| `none` | Empty target or similarity below `0.20` after semantic paths fail | Start anchor with progress `0`, or no anchor for an empty document | Mandatory not-found notice; start action only |

`intraBlockRatio` is preserved and clamped for identity/path mappings, including oversized indivisible blocks. Ratio fallback derives a new intra-block ratio from the target source coordinate. Exact confidence is never inferred from overall ratio proximity.

The `0.20` ratio gate separates the nearest fixed-corpus cases: the intentionally accepted ratio fallback scored `0.286`; the radical rewrite scored `0`. Production tasks must rerun the corpus with representative user-safe update pairs before broadening this threshold.

## Update-pair results

| Pair | Expected/actual confidence | Reason | Similarity | Expected-block distance | Average mapping time |
|---|---|---|---:|---:|---:|
| `small-block-insertion` | exact / exact | `CROSS_VERSION_CONTENT_FINGERPRINT` | 0.933 | 0 | 8.697 us |
| `no-headings-insertion` | exact / exact | `CROSS_VERSION_CONTENT_FINGERPRINT` | 0.857 | 0 | 2.465 us |
| `changed-block-same-heading` | approximate / approximate | `CROSS_VERSION_PATH_ORDINAL` | 0.857 | 0 | 5.896 us |
| `renamed-heading` | approximate / approximate | `CROSS_VERSION_ANCESTOR_ORDINAL` | 0.778 | 0 | 7.969 us |
| `removed-heading` | approximate / approximate | `CROSS_VERSION_ANCESTOR_ORDINAL` | 0.917 | 0 | 10.382 us |
| `reordered-repeated-heading` | exact / exact | `CROSS_VERSION_CONTENT_FINGERPRINT` | 1.000 | 0 | 7.322 us |
| `ratio-fallback` | approximate / approximate | `OVERALL_SOURCE_RATIO` | 0.286 | 0 | 6.176 us |
| `radical-rewrite` | none / none | `NO_RELIABLE_MATCH` | 0.000 | 0 (start) | 5.666 us |

The repeated-heading regression separately anchors the duplicated heading itself. Its fingerprint is ambiguous, so the result is approximate rather than a false exact. The reordered unique body under that heading remains exact.

Same-version sampling covers start, middle and end across both reading modes and all five persisted layouts (`auto`, `h1`, `h2`, `h3`, `whole`): all 30 combinations resolve the identical block with distance `0` and `SAME_VERSION_BLOCK_ID`.

## Pipeline-version regression

Adding one SHA-256 fingerprint per top-level block changed derived chunk data and was verified through the pipeline, security, storage and build suites. A visible P00 pipeline rerun after the change measured:

| Fixture | Blocks | Metadata stage | Total pipeline time |
|---|---:|---:|---:|
| `small` | 10 | 4.91 ms | 22.94 ms |
| `medium` | 203 | 8.74 ms | 45.38 ms |
| `large` | 935 | 40.78 ms | 174.20 ms |

Single-run stage timings are noisy. P02-T01 must rerun production/browser pipeline measurements; this spike only establishes that fingerprint generation stayed inside the prior whole-pipeline envelope on the deterministic corpus.

## Verification evidence

- Targeted mapping suite: 18 tests passed, including corpus table, headingless content, same-version layouts, repeated headings, invalid fingerprint rejection, oversized blocks, ratio boundaries, empty target, reason exhaustiveness and 250 deterministic property samples.
- `corepack pnpm typecheck`: passed.
- `corepack pnpm lint`: passed.
- `corepack pnpm test`: 6 files, 51 tests passed.
- `corepack pnpm test:security`: 1 file, 3 tests passed.
- `corepack pnpm test:bench`: 3 files, 4 tests passed.
- `corepack pnpm build`: passed with Vite `8.1.5`.
- Targeted storage migration/rebuild regression: 9 tests passed, including source Blob preservation for derived rebuild.

## Downstream values and residual risks

P03-T04 should reuse the same-version reason order, ratio clamping and UI trigger matrix. P04-T02 should supply validated source/target block metadata, persist only the returned target-version anchor and preserve the `exact`/`approximate`/`none` result for one-time Reader notice behavior.

The synthetic corpus has no misses. Residual risks are limited corpus diversity, deliberate conservatism for duplicated unchanged blocks, and the need to validate the `0.20` similarity gate on production fixtures. SHA-256 collision risk is negligible, but uniqueness in both versions remains mandatory so repeated content never becomes exact merely because hashes match.

This task unblocks the mapping portions of `P03-T03`, `P03-T04` and `P04-T02`. The next unblocked P00 task is `P00-T06`.
