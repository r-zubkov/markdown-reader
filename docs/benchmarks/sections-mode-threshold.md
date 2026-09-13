# P03-T03 initial reading-mode threshold

Status: **accepted for P03-T03**.

## Decision

`AUTO_SECTIONS_COST_THRESHOLD` is **24,000 estimated-cost units**. A document
starts in `continuous` mode when its total persisted chunk cost is at or below
the threshold, and in `sections` mode only when it exceeds the threshold. The
metric is the sum of `PersistablePipelineChunk.estimatedCost`, so it reflects
the parsed/rendered structure rather than raw file bytes.

The inclusive boundary deliberately matches the accepted production pipeline
safe logical-section ceiling, `maxChunkCostBeforeFallback=24,000`. A document
above that ceiling begins in the bounded sections presentation; a user can
always choose another available presentation afterward.

## Reproducible corpus evidence

Measured on 2026-09-13 with the committed production pipeline version 4 and
Vitest 4.1.11:

```text
node_modules/.bin/vitest.cmd run src/domain/reading/reading-mode.test.ts --reporter verbose
```

| Fixture | Total estimated cost | Initial mode |
|---|---:|---|
| small | 966 | continuous |
| medium | 36,512 | sections |
| large | 177,090 | sections |
| no-headings | 272 | continuous |
| repeated-unicode-headings | 398 | continuous |
| long-code | 18,479 | continuous |
| single-long-line | 32,367 | sections |
| wide-table | 7,393 | continuous |
| huge-single-node | 34,439 | sections |
| malicious | 1,129 | continuous |

The boundary and fixture matrix are regression-tested in
`src/domain/reading/reading-mode.test.ts`. Any pipeline-cost change requires
this measurement to be rerun and the decision reconsidered before changing
the threshold.
