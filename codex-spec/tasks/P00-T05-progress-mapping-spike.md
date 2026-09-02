# P00-T05 Semantic progress mapping spike

## Outcome

Deterministic semantic-anchor mapping and confidence policy are validated on mode/strategy changes and edited-version pairs with explicit exact/approximate/none tolerances.

## Why now

Reader persistence and replace UX cannot be implemented honestly until confidence labels mean something measurable.

## Read before starting

`AGENTS.md`; `codex-spec/features/risk-spikes.md` Spike D; `codex-spec/features/sections-toc-progress.md`; `codex-spec/architecture/data-and-state.md` anchors/mapping; `codex-spec/features/document-lifecycle.md` mapping result.

## Related requirements

PRD-011, PRD-013, TECH-010, NFR-001; DEC-009, DFR-001.

## Preconditions

P00-T02 complete with update-pair corpus and block/heading metadata. Dependencies: P00-T02.

## Scope

- Implement/prototype pure mapping order from specs.
- Sample anchors at meaningful positions across same-version layouts and update pairs.
- Define expected target, distance/tolerance and confidence reason.
- Test heading rename/removal/reorder, repeated headings, block insertions and radical rewrite.
- Save report, algorithm decision and UI trigger matrix; update anchor contract if evidence requires.

## Non-goals

No scroll observer, IndexedDB write throttle, final Reader UI or machine-learning similarity.

## Expected files

Pure mapping prototype/domain module, update-pair fixtures/expectations, property/corpus tests, `docs/benchmarks/progress-mapping-spike.md`.

## Implementation notes

Never call a result exact solely because overall ratio is close. Preserve version-specific IDs correctly. Algorithm must be deterministic and explainable through stable reason codes.

## UI and states

Only define result copy triggers for exact/approximate/none; visual implementation later.

## Edge cases

Empty documents, missing headings, duplicate paths, anchor inside oversized block, new version shorter/longer, start/end ratios, all headings changed.

## Acceptance criteria

- [ ] Same-version mode/strategy samples meet exact tolerance.
- [ ] Small/moved edits produce expected exact/approximate result with reason.
- [ ] Radical changes fall back honestly; no false exact cases in corpus.
- [ ] Mapping is deterministic and tests record expected target/confidence.
- [ ] Report defines values needed by P03-T04/P04-T02.

## Required tests

Corpus table tests, property tests for ratio/range safety and determinism, reason-code exhaustiveness.

## Verification

Run `pnpm typecheck`, `pnpm lint`, targeted mapping tests, `pnpm test`, `pnpm test:bench`, `pnpm build`.

## Completion report

Report algorithm/tolerance/confidence results, changed contracts/files, commands, corpus misses, residual risks and unblocked tasks.
