# P05-T05 Final acceptance and handoff

## Outcome

The MVP has a completed evidence-linked acceptance checklist, reconciled implementation status/documentation and a reproducible release-candidate handoff.

## Why now

Only after hardening can the project be declared complete without confusing planned requirements with verified behavior.

## Read before starting

`AGENTS.md`; `codex-spec/final-acceptance-checklist.md`; `codex-spec/testing-and-quality.md`; `codex-spec/implementation-roadmap.md`; `codex-spec/requirements-and-decisions.md` traceability; all completion reports/benchmark/manual evidence.

## Related requirements

All MVP requirements; especially PRD-018, NFR-010 and CON-001–005.

## Preconditions

P05-T04 and every earlier phase gate completed. Dependencies: P05-T04 plus all tasks P00–P04.

## Scope

- Verify actual code/repository against every checklist item and requirement trace.
- Rerun final required commands on release-candidate state; record commit/build/environment.
- Resolve stale names/routes/enums/docs/task status and ensure no orphan requirement/task/cycle.
- Fill acceptance evidence, known residual issues/approved waivers, browser/device/performance/accessibility records.
- Produce concise developer/user handoff for run/build/deploy/local-data limitations and first post-MVP priorities.

## Non-goals

No new feature, hidden scope change, cosmetic refactor unrelated to failed acceptance or unapproved waiver.

## Expected files

Completed acceptance/status/release notes/deployment handoff and only code/tests necessary to close discovered acceptance defects.

## Implementation notes

Checklist boxes require evidence. If any blocker remains, final decision is REJECTED/BLOCKED and exact next task is created; do not mark completed. Preserve `OPEN-001` as isolated nonblocking brand placeholder if unresolved.

## UI and states

No new UI; smoke all core states and non-goals absence.

## Edge cases

Docs reference old command/path, skipped physical test, benchmark from different build, flaky test, unapproved browser gap, release host lacks SPA fallback/CSP.

## Acceptance criteria

- [ ] Every MVP requirement maps to implemented code/task/test evidence.
- [ ] Final checklist has no unchecked blocker or silent waiver.
- [ ] All final commands pass on recorded release-candidate state.
- [ ] Deployment/browser/storage/privacy limitations are explicit and accurate.
- [ ] Roadmap/status/terms match actual code and post-MVP remains separate.

## Required tests

Full release suite plus manual smoke from `codex-spec/testing-and-quality.md`; rerun only from clean/controlled state and attach results.

## Verification

Run `pnpm install --frozen-lockfile`, all commands from P05-T04, production preview smoke and link every manual report. Validate local Markdown links/docs references.

## Completion report

State ACCEPTED/REJECTED, release commit/build, requirement/task counts, command/browser/device evidence, remaining approved waivers/open brand item, deployment instructions and recommended first post-MVP task.
