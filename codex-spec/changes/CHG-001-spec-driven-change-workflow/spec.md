# CHG-001 Specification: Spec-driven change workflow

## Intent

The repository owner needs future requests to become auditable, well-scoped implementation work without losing the architectural, safety and verification discipline established during MVP delivery.

## User scenarios

### US-001 Submit an informal request — Priority P1

- Given: the owner describes a feature, redesign, bug or technical change in ordinary language.
- When: a coding agent begins work and no existing task covers the request.
- Then: the agent records a stable change, selects a proportional track and identifies the next stage before application edits.
- Independent verification: the standing rules and workflow describe the same route and artifact ownership.

### US-002 Resolve meaningful ambiguity — Priority P1

- Given: the request permits materially different scopes or safety/UX outcomes.
- When: the change is assessed.
- Then: the agent distinguishes problem from solution, records assumptions, asks focused questions and does not plan on top of an unresolved material choice.
- Independent verification: blocking clarification markers cannot pass the specified/ready gates.

### US-003 Distribute implementation safely — Priority P1

- Given: an approved specification and technical plan exist.
- When: implementation work is decomposed.
- Then: each atomic task has traceable requirements, dependencies, verification and non-overlapping ownership; only safe work is marked parallel.
- Independent verification: task-plan coverage and consistency analysis expose orphan requirements, orphan tasks and contract collisions.

### US-004 Close against delivered reality — Priority P1

- Given: all planned implementation tasks have run.
- When: the change is reviewed for completion.
- Then: code, tests, canonical documents and approved artifacts are compared; gaps create follow-up tasks instead of being hidden.
- Independent verification: completion requires convergence evidence and passing required checks.

### US-005 Use proportional process — Priority P2

- Given: the request is a small reversible change with no contract or risk impact.
- When: it meets every fast-track boundary.
- Then: proposal, specification and plan may remain inline in one atomic task while identity, acceptance and evidence remain traceable.
- Independent verification: the workflow lists conditions that forbid the fast track.

## Functional requirements

- `CHG-001-FR-001`: every new work request without an existing task receives a stable registry identity and a selected work track.
- `CHG-001-FR-002`: the process separates assessment, behavioral specification, technical planning, task decomposition, consistency analysis, implementation and convergence.
- `CHG-001-FR-003`: standard/discovery changes store durable artifacts under one change directory; fast changes may inline them in one task.
- `CHG-001-FR-004`: task files remain the sole authority for executable scope and verification.
- `CHG-001-FR-005`: the process defines explicit lifecycle states, entry/exit gates and terminal outcomes.
- `CHG-001-FR-006`: material scope, safety, privacy, data or UX choices require clarification rather than silent assumptions.
- `CHG-001-FR-007`: task decomposition records dependencies, shared-contract ownership and safe parallel groups.
- `CHG-001-FR-008`: read-only analysis checks cross-artifact consistency and traceability before implementation.
- `CHG-001-FR-009`: convergence compares delivered reality with approved artifacts and creates traceable follow-up work for gaps.
- `CHG-001-FR-010`: the accepted P00-P05 history remains true and is not migrated or reopened.
- `CHG-001-FR-011`: the process does not introduce `.specify` or another competing source of truth without a later explicit migration decision.

## Quality and policy requirements

- Data integrity: future schema/pipeline/protocol work cannot bypass migration, versioning and recovery gates.
- Security/privacy: future boundary changes require explicit plan and verification coverage.
- Accessibility/responsive behavior: affected UI work must retain the existing mandatory matrix.
- Offline/platform behavior: affected platform work must identify production-PWA verification.
- Performance: affected pipeline/reader work must identify benchmark triggers.

## States and edge cases

- The lifecycle includes proposed, assessing, needs-clarification, approved, specified, planned, ready, in-progress, verifying, completed, parked, rejected and superseded.
- An explicit plan-only request stops before application code.
- Urgent containment still requires a minimal task before application edits.
- A mid-implementation material discovery returns to the owning artifact and downstream analysis.
- Historical evidence is appended or superseded, not silently rewritten.

## Scope

### In scope

- Repository documentation, templates, standing rules, registry, roadmap and task/status reconciliation.

### Out of scope

- Application code, package dependencies, external issue trackers, a scaffolding CLI and migration of historical tasks.

## Success criteria

- `CHG-001-SC-001`: a reader can identify the correct track and next artifact for each stated request class without relying on undocumented convention.
- `CHG-001-SC-002`: every required artifact has a reusable template or an explicitly defined inline fast-track equivalent.
- `CHG-001-SC-003`: requirement-to-task, task-to-verification and change-to-completion traceability are defined end to end.
- `CHG-001-SC-004`: the workflow contains objective blockers for premature implementation and completion.
- `CHG-001-SC-005`: no application source, dependency or accepted MVP evidence changes.

## Assumptions and clarifications

- Assumption: natural-language invocation is preferred over adding a new CLI before repeated use proves automation value.
- Resolved clarification: GitHub Spec Kit is a conceptual reference, not a second installed authority.
- Resolved clarification: existing `Pxx-Tyy` task IDs and phase roadmap remain in use.

## Durable traceability

- Existing requirements/decisions affected: NFR-010, DEC-004 and DEC-021.
- New durable requirement or decision needed: NFR-011 and DEC-023.
- Canonical documents to update: `AGENTS.md`, specification navigator, requirements/decisions, roadmap, implementation status and execution playbook.
