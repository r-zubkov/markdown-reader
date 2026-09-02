# P00-T02 Content pipeline and limits spike

## Outcome

Reproducible corpus proves or rejects the proposed parse/partition/sanitize/highlight pipeline and yields measured `PipelineLimits`, highlight grammar policy and security/no-loss evidence.

## Why now

Import implementation cannot safely choose file/chunk/node limits or output contracts from intuition.

## Read before starting

`AGENTS.md`; `codex-spec/features/risk-spikes.md` shared corpus/Spike A; `codex-spec/features/markdown-pipeline.md`; `codex-spec/architecture/system-architecture.md` trust boundaries; `codex-spec/architecture/data-and-state.md` output contracts.

## Related requirements

PRD-004, PRD-010, TECH-003–007, NFR-001, NFR-003, NFR-004; DFR-001/002.

## Preconditions

P00-T01 complete. Dependencies: P00-T01.

## Scope

- Build deterministic generated corpus and expected marker metadata.
- Prototype the exact proposed unified/GFM→HAST→policy→lowlight→sanitize→serialize order in worker-compatible pure modules.
- Implement/test partition/layout invariants for all strategies and oversized-node fallback candidates.
- Run malicious HTML/URL/clobbering/data-image corpus.
- Measure stages/output/batches/main-thread responsiveness proxy across small/medium/large/pathological fixtures.
- Evaluate core grammar set/aliases, auto-detect cost/confidence, fatal UTF-8 and SHA-256 full-buffer behavior.
- Save report with environment, method, results, proposed limits/fallbacks and updates required for DFR-001/002/DEC.

## Non-goals

No production ImportFlow, IndexedDB commit, final reader CSS or unsupported Markdown plugins.

## Expected files

Spike/corpus/test directories, generated fixture scripts, pipeline prototype modules, benchmark/security tests, `docs/benchmarks/pipeline-spike.md` or repository-equivalent, central proposed limits module not yet treated as release-final until approved.

## Implementation notes

Assert semantic markers/DOM, not one huge whitespace-sensitive snapshot. Sanitizer runs after highlight. Raw HTML must be inert. If browser memory cannot be measured, record proxy/method honestly. Do not commit copyrighted documents.

## UI and states

None beyond optional diagnostic page/CLI output; user-facing error codes/messages are proposed, not polished.

## Edge cases

No headings, repeated Unicode headings, footnotes, task lists, long code/line/table, zero-byte, invalid UTF-8, dangerous encoded protocols, SVG data, unknown language, parser/highlight failure.

## Acceptance criteria

- [ ] Every corpus marker appears exactly once and in order; no top-level node splits.
- [ ] All layouts cover the entire chunk range, including `whole` with internal chunks.
- [ ] Security corpus has no executable/unsafe/clobbering output.
- [ ] Fatal/fallback thresholds are evidence-backed with below/at/above fixtures.
- [ ] Grammar/auto-detect recommendation and unresolved measurement limitations are explicit.

## Required tests

Golden semantic, property/fuzz deterministic seeds, URL matrix, malicious DOM assertions, worker-compatible benchmark and boundary fixtures.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:security`, `pnpm test:bench`, `pnpm build`.

## Completion report

Summarize corpus, measurements, selected/rejected options, proposed limits/grammars, security/no-loss results, changed files, commands, decisions/deferred updates and whether P00-T05/P02-T01 are unblocked.
