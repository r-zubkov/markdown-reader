# P05-T04 Security, accessibility and browser hardening

## Outcome

The integrated MVP passes current security corpus, accessibility/responsive matrix, all-browser E2E and measured performance budgets with deployment CSP/headers aligned to runtime.

## Why now

This task evaluates the assembled system; earlier isolated checks cannot prove cross-feature release quality.

## Read before starting

`AGENTS.md`; `codex-spec/testing-and-quality.md`; `codex-spec/final-acceptance-checklist.md`; `codex-spec/architecture/system-architecture.md` trust/CSP; `codex-spec/design/ui-design-system.md` accessibility; all F00 reports.

## Related requirements

NFR-001–010, TECH-005, TECH-011, UX-005–008.

## Preconditions

P05-T01/T02/T03, P02-T01, P04-T02/T03 complete. Dependencies: P05-T01, P05-T02, P05-T03, P02-T01, P04-T02, P04-T03.

## Scope

- Run/fix full malicious corpus, CSP/header and network/log/privacy audits.
- Run/fix type/lint/unit/integration/security and all-browser E2E matrix.
- Run/fix large/pathological performance regression against approved limits.
- Complete 320/390/768/1024/1120/1440, zoom/text-spacing/forced-colors/reduced-motion and both-theme visual checks.
- Complete keyboard, axe, NVDA/VoiceOver and physical iPhone core checklist; record exact environment.
- Resolve flaky required tests and document deployment requirements/residual nonblocking issues.

## Non-goals

No new product feature, unapproved scope reduction, arbitrary redesign or raising budgets to make failures green without evidence.

## Expected files

Fixes across affected modules, deployment/security header docs/config, updated test corpus/benchmarks/manual reports and browser matrix evidence.

## Implementation notes

Treat content loss/XSS/partial publication/focus loss/sustained reader gaps as blockers. A waiver needs explicit user/reviewer approval and cannot be invented by Codex. Do not log sensitive fixture content.

## UI and states

Every required L/R/O/G/E state in light/dark and relevant widths; validate status overlap and focus under integrated events.

## Edge cases

Combined update+offline+quota, replace during old SW, theme/remote toggle mid-scroll, corrupt staging on startup, physical Safari background/foreground, multiple titles/large TOC.

## Acceptance criteria

- [ ] Security/CSP/network/privacy gates pass with no unsafe injection/request/log.
- [ ] All required automated suites/browsers/build pass without unresolved flake.
- [ ] Performance values meet approved reports or an explicit decision/fallback is applied and retested.
- [ ] Automated/manual accessibility/responsive/theme/device matrix passes with recorded environment.
- [ ] No known blocking defect remains; residual issues are classified/linked.

## Required tests

Full release suite from `codex-spec/testing-and-quality.md` and manual records; add regression for every defect fixed.

## Verification

Run all target commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:security`, `pnpm test:bench`, `pnpm test:e2e:all`, `pnpm build`; production preview/manual matrices.

## Completion report

Provide complete commands/results, browsers/devices, budgets, a11y/security findings/fixes, changed files, residual defects/waivers and final-acceptance readiness.
