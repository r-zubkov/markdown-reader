# P06-T01 Spec-driven change workflow

## Outcome

The accepted MVP gains a durable, repository-native workflow for turning a new idea, bug, redesign or technical change into clarified specifications, an implementation plan, dependency-ordered atomic tasks, verified implementation and an auditable completion record.

## Why now

The P00-P05 delivery system executes prepared tasks well, but it does not define how post-MVP requests enter the specification set. Without an intake and change-governance layer, future work can bypass product clarification, duplicate sources of truth or begin implementation before scope and acceptance are stable.

## Related change

CHG-001. See `codex-spec/changes/CHG-001-spec-driven-change-workflow/`.

## Read before starting

`AGENTS.md`; `codex-spec/README.md`; `codex-spec/project-source-of-truth.md`; `codex-spec/requirements-and-decisions.md`; `codex-spec/implementation-roadmap.md`; `codex-spec/implementation-status.md`; `codex-spec/execution-playbook.md`; one representative completed task; current official GitHub Spec Kit documentation for idea assessment and Agentic SDD.

## Related requirements

NFR-010, DEC-004, DEC-021 and the post-MVP governance gap identified after P05 acceptance.

## Preconditions

P05-T05 is complete. The accepted MVP remains the baseline and must not be reopened by adding a post-MVP process.

## Scope

- Define a project-native lifecycle from intake and clarification through specification, plan, task decomposition, consistency analysis, implementation and convergence.
- Define lightweight, standard and discovery tracks so small changes do not require feature-sized paperwork while risky changes cannot skip analysis.
- Add stable change IDs, a change registry and per-change artifact conventions without replacing existing requirement IDs or `Pxx-Tyy` task IDs.
- Add reusable English-only templates for change proposal, behavior specification, technical plan, task index, requirements-quality checklist and completion/convergence record.
- Define approval gates, status transitions, traceability, task sizing, dependency/parallel-work rules and mid-implementation change handling.
- Reconcile `AGENTS.md`, the specification navigator, execution playbook, roadmap and implementation status with the new workflow.
- Record why the workflow adopts Spec Kit concepts without initializing a second `.specify` source of truth.

## Non-goals

Do not install the Spec Kit CLI, add a runtime dependency, create GitHub issues, change application behavior, reopen accepted MVP criteria or migrate historical P00-P05 artifacts into a new directory layout.

## Expected files

`AGENTS.md`; `codex-spec/README.md`; a change-workflow document; a change registry; reusable templates under `codex-spec/templates/`; this task; `codex-spec/implementation-roadmap.md`; current post-MVP task status; optionally a completed change package that dogfoods the new workflow.

## Implementation notes

Treat `AGENTS.md` plus canonical requirement/architecture/design documents as the project's constitution layer. Keep discovery separate from delivery. The behavior specification states what and why; the plan owns how; task files own executable scope and verification. Quality analysis is read-only and findings are fixed in their source artifact. Reviewer-owned checklist state must not be silently self-approved by implementation work.

## UI and states

No product UI change. The documentation workflow must define visible lifecycle states and terminal outcomes for proposed, approved, parked, rejected, superseded and completed changes.

## Edge cases

Tiny bug, urgent safety fix, design-only change, dependency upgrade, schema/protocol/pipeline change, one request containing several independent features, work discovered during implementation, interrupted sessions, rejected ideas and completed-MVP documentation that must remain historically true.

## Acceptance criteria

- [x] A new request can be classified and routed without inventing a process per session.
- [x] Required artifacts, owners, entry criteria and exit gates are explicit for every lifecycle stage.
- [x] Small changes have a bounded fast track; cross-cutting or ambiguous changes cannot use it.
- [x] Stable change IDs map specifications to existing requirement IDs, roadmap phases, atomic task files and completion evidence.
- [x] New task creation, safe parallelization, clarification, approval and scope-change rules are unambiguous.
- [x] Existing P00-P05 history and MVP acceptance remain accurate.
- [x] Documentation has no competing source of truth and explains the Spec Kit adaptation decision.

## Required tests

Documentation local-link audit; English-language/manual structure review; traceability review across navigator, workflow, registry, roadmap, status and templates; `git diff --check`.

## Verification

Run the repository Markdown local-link audit used by P05-T05 or an equivalent read-only check; `git diff --check`; inspect `git diff`; confirm no application source or dependency files changed.

## Completion report

List the adopted Spec Kit concepts, project-specific deviations, workflow stages/tracks/gates, created templates, reconciled documents, commands and results, closed acceptance criteria and remaining optional automation.
