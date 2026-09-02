# P02-T01 Production Markdown pipeline

## Outcome

The import worker implements the complete evidence-backed CommonMark/GFM, outline/anchor, internal chunk/layout, URL, highlight, sanitize and batch pipeline with central measured limits.

## Why now

The walking pipeline must become complete and security-reviewed before Reader/lifecycle relies on its metadata.

## Read before starting

`AGENTS.md`; `codex-spec/features/markdown-pipeline.md`; `codex-spec/architecture/data-and-state.md` IDs/output; `codex-spec/architecture/system-architecture.md` worker/security; P00-T02 report.

## Related requirements

PRD-004, PRD-005, PRD-009–010, PRD-017, TECH-003–007, TECH-010, NFR-001, NFR-003–004.

## Preconditions

P01-T03 and P00-T02 complete; DFR-001/002 pipeline decisions recorded. Dependencies: P01-T03, P00-T02.

## Scope

- Promote/refactor validated spike pipeline into production domain/worker modules without React/Dexie dependencies.
- Implement all steps/order/policies and Russian footnote accessibility labels.
- Generate title, outline, deterministic IDs/path keys/block anchors, all strategy layouts and bounded batches.
- Implement limited grammars/alias/autodetect and oversized/failure fallback per measured policy.
- Centralize `PipelineLimits`, `PIPELINE_VERSION`, warnings and stable errors; repository persists validated outputs.
- Add security/no-loss/determinism/boundary performance regression suites.

## Non-goals

No Reader rendering/TOC UI, search, raw executable HTML, additional Markdown dialects or unmeasured grammar expansion.

## Expected files

`src/domain/content`, worker pipeline/protocol integration, policy/schema/highlight modules, central limits/version, corpus/security/property tests.

## Implementation notes

Sanitize after highlight and before serialize. Brand remains repository concern after persistence. Avoid post-sanitize mutations. Do not pass full AST to main or persist it. Pipeline bump requires rebuild path tests.

## UI and states

Expose human-mappable stages/warnings/errors only; no UI changes except integration compatibility.

## Edge cases

All F02 cases plus pipeline mismatch/rebuild, batch boundaries, footnote clobber prefix and source position absent/inconsistent.

## Acceptance criteria

- [ ] Complete feature corpus renders semantic supported output deterministically.
- [ ] No-loss/layout property tests and security corpus pass.
- [ ] Unknown/oversized/highlight failure returns defined safe fallback without truncating other content.
- [ ] Worker/main batches obey measured limits/protocol and keep main responsive.
- [ ] Pipeline version mismatch cannot render stale HTML and rebuild path is tested.

## Required tests

F02 full suite: semantic corpus, property/fuzz, malicious DOM/URL, code policy, protocol/batches, deterministic output, threshold performance regression.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:security`, `pnpm test:bench`, `pnpm test:e2e` import corpus smoke, `pnpm build`.

## Completion report

List supported dialect/grammars/limits/version, fallbacks, security/no-loss evidence, files/commands, deviations and remaining corpus risks.
