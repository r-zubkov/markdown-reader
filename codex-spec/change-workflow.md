# Spec-driven change workflow

## Purpose

This document defines how a new idea, bug, redesign, dependency change or technical improvement enters the repository after the accepted MVP. It fills the gap between an informal request and the existing atomic-task execution process.

The workflow adapts the useful parts of GitHub Spec Kit's official [Idea Assessment](https://github.com/github/spec-kit/tree/main/extensions/assess) and [Agentic SDD](https://github.github.com/spec-kit/reference/agentic-sdd.html) models to this repository:

`intake -> assess/clarify -> specify -> plan -> review -> decompose -> analyze -> implement -> converge`

It does not initialize Spec Kit or create `.specify/`. This repository already has a mature source of truth under `codex-spec/`; a second generated specification tree would make authority and history ambiguous.

Reference reviewed: 2026-10-02. External documentation is research provenance, not a runtime dependency or authority over this repository's standing rules.

## Authority model

The governing order remains:

1. latest explicit user instruction;
2. safety, privacy and data integrity;
3. [requirements-and-decisions.md](requirements-and-decisions.md);
4. the active atomic task;
5. the relevant change specification;
6. feature, architecture, data and design documents;
7. documented assumptions.

[AGENTS.md](../AGENTS.md) and the canonical documents listed in [README.md](README.md) are the project constitution. A per-change artifact may refine them only when the same change updates the canonical document that owns the affected rule. It may not silently override them.

Task files remain authoritative for executable scope and verification. The change package explains intent, behavior, design and task relationships. [implementation-roadmap.md](implementation-roadmap.md) owns phase order, [post-mvp-task-status.md](post-mvp-task-status.md) owns current post-MVP task execution status, [implementation-status.md](implementation-status.md) preserves accepted P00-P05 evidence, and [change-registry.md](change-registry.md) owns change lifecycle status.

## Mapping from Spec Kit concepts

| Spec Kit concept | Repository-native equivalent |
|---|---|
| Constitution | `AGENTS.md` plus canonical requirements, architecture, design and quality documents |
| Idea assessment | Change registry entry plus `proposal.md` for standard/discovery work |
| Specify and clarify | `spec.md`, with resolved questions and explicit assumptions |
| Plan | `plan.md` |
| Requirements checklist | Optional reviewer-owned `checklist.md` |
| Tasks | `task-plan.md` plus authoritative `codex-spec/tasks/Pxx-Tyy-*.md` files |
| Analyze | Read-only `analysis.md` consistency and coverage review |
| Implement | One atomic task per implementation session under the execution playbook |
| Converge | `completion.md`; missing work becomes a new task rather than a hidden scope expansion |
| Tasks to issues | Not adopted; external issue creation requires an explicit later decision |

## Change IDs, task IDs and storage

- Every new work request without an existing task receives the next immutable `CHG-NNN` ID in [change-registry.md](change-registry.md). Never reuse or renumber an ID.
- Use a lowercase hyphenated slug and, when a change package is required, store it at `codex-spec/changes/CHG-NNN-short-name/`.
- Existing `Pxx-Tyy` task IDs remain the executable unit. Phase numbers are assigned in the roadmap; they are not inferred from the change ID.
- Every new task names its related change ID. One change may produce one or many tasks; a task should normally serve one change.
- Historical P00-P05 tasks are not retrofitted with change IDs. Their existing specifications and completion evidence remain authoritative.

## Lifecycle states

The registry uses these states:

| State | Meaning |
|---|---|
| `proposed` | Request captured; classification is not complete. |
| `assessing` | Problem, evidence, options or material questions are being examined. |
| `needs-clarification` | A decision that materially changes scope, safety or UX requires user input. |
| `approved` | The change has a defensible `go` decision and may be specified. |
| `specified` | Behavior, boundaries and measurable success are stable enough to plan. |
| `planned` | Technical plan and atomic task decomposition exist. |
| `ready` | Consistency analysis passed and the next task is unblocked. |
| `in-progress` | At least one task is actively being implemented. |
| `verifying` | Implementation is complete enough for required checks and convergence review. |
| `completed` | Specification, implementation, evidence and canonical documents agree. |
| `parked` | Worth retaining, but intentionally deferred with a revisit trigger. |
| `rejected` | Closed with a recorded reason; rejecting weak work is a valid outcome. |
| `superseded` | Replaced by another named change. |

State transitions are forward-moving except that failed review returns work to the stage that owns the defect. Do not mark a change `completed` merely because all planned tasks were attempted.

## Work tracks

### Fast track

Use for a small, well-understood, reversible change that can be completed and verified as one task. The task file may contain the intake, specification and plan inline. The change still receives a registry entry and task ID.

Fast track is forbidden when any of these apply:

- a new user-visible capability or a multi-screen behavior change;
- unresolved product or UX alternatives;
- IndexedDB schema, worker protocol, pipeline, sanitizer, CSP or public port changes;
- security, privacy, data-loss, accessibility or browser-support implications;
- a new runtime dependency or removal/replacement of an established dependency;
- more than one independently deliverable task;
- multiple agents would need to edit the same contract or configuration;
- success cannot be described with objective acceptance criteria.

Typical examples: a localized copy correction, a narrow styling defect covered by existing design rules, a deterministic bug with a known root cause, or execution-document clarification.

### Standard track

Use for a new feature, meaningful redesign, cross-module behavior, nontrivial refactor, dependency change or any request that needs more than one task. Required artifacts are `proposal.md`, `spec.md`, `plan.md`, `task-plan.md`, `analysis.md` and `completion.md`. A reviewer checklist is optional unless a material quality risk warrants one.

### Discovery track

Use when the problem, value, feasibility or solution direction is uncertain, or when the change touches data durability, security/privacy boundaries, a new platform/browser, backend/sync, a major dependency or a large product direction. The proposal must include evidence for and against the idea, two or more viable options when they exist, appetite, risks and a `go`, `needs-clarification`, `park` or `reject` decision. A `go` decision is required before specification.

An urgent safety or data-integrity fix may use a minimal containment task first, but the task must exist before application edits, must minimize blast radius, and must reconcile the durable specification and follow-up work before it is closed.

## Artifact requirements

| Artifact | Fast | Standard | Discovery | Owner and purpose |
|---|---:|---:|---:|---|
| Registry row | required | required | required | Lifecycle identity and current state |
| Atomic task | required | required | required after `go` | Executable scope, tests and completion report |
| `proposal.md` | inline in task | required | required and evidence-rich | Intake, problem, options, decision and handoff |
| `spec.md` | inline in task | required | required | User-visible `what` and `why`, not implementation detail |
| `plan.md` | inline in task | required | required | Repository-specific `how`, risks and verification strategy |
| `task-plan.md` | one task link | required | required | Dependency graph, task ownership and safe parallel groups |
| `checklist.md` | optional | risk-based | normally required | Reviewer-owned requirements-quality gate |
| `analysis.md` | inline pass | required | required | Read-only cross-artifact consistency review |
| `completion.md` | task report may suffice | required | required | Convergence, evidence, deviations and follow-up |

Use the files in [templates/](templates/) as starting points. Delete placeholder guidance that is not applicable; do not retain empty ceremony.

## Delivery stages

### 1. Intake and route

Capture the request faithfully before proposing a solution. Identify the requester goal, affected users, observed problem, constraints, requested delivery mode (`assess`, `plan only`, or `implement`) and available evidence. Inspect the real repository before selecting a track.

Split a request when it contains independent outcomes that can be accepted or rejected separately. Keep one change when the parts must ship atomically to produce any user value.

Exit gate:

- a `CHG-NNN` row exists;
- kind and track are recorded;
- the next stage and any blocking question are explicit.

### 2. Assess and clarify

For standard work, establish the problem, desired outcome, boundaries and obvious alternatives. For discovery work, also gather repository evidence, relevant primary-source research, evidence against the idea, feasibility and appetite.

Ask only questions whose answers materially change scope, safety, data handling or user experience. Ask up to three focused questions per pass and prioritize scope, security/privacy/data integrity, UX, then technical preference. Use reasonable reversible defaults for nonmaterial details and record them as assumptions.

Use `[NEEDS CLARIFICATION: ...]` only for a concrete unresolved choice. Do not let such a marker survive into a task that depends on the answer.

Exit gate:

- the problem is separated from the proposed solution;
- goals, non-goals, evidence strength and material unknowns are visible;
- the decision is `go`, `needs-clarification`, `park` or `reject`;
- only `go` proceeds to specification.

### 3. Specify behavior

The specification owns `what` and `why`:

- prioritized user scenarios and acceptance examples;
- functional requirements with stable change-local IDs;
- measurable success criteria;
- edge, loading, empty, error, offline, disabled and recovery states when applicable;
- accessibility, privacy and data-safety expectations;
- in-scope and out-of-scope behavior;
- assumptions and resolved clarifications;
- links to affected durable `PRD`, `TECH`, `UX`, `NFR`, `DEC`, `DFR` or `OPEN` entries.

Do not prescribe libraries, file paths or class names in `spec.md` unless the constraint is itself user-visible or constitution-level. Add or change durable requirement IDs only in [requirements-and-decisions.md](requirements-and-decisions.md), not solely in a change package.

Exit gate: each scenario is independently testable, each success criterion is measurable, and no material clarification remains.

### 4. Plan implementation

The plan owns `how`. It must be based on the actual repository, not an assumed greenfield layout. Cover only relevant items:

- affected modules, ports, records, routes, worker messages, UI states and canonical documents;
- chosen design and rejected alternatives with rationale;
- schema migration, compatibility, rollback/recovery and source rebuild behavior;
- trust boundaries, privacy and CSP/network effects;
- responsive, keyboard, focus, reduced-motion and localization effects;
- performance budgets and benchmark triggers;
- dependency responsibility, license/peer/runtime compatibility and lockfile impact;
- test layers, fixtures, browser/manual evidence and exact verification commands;
- rollout or cleanup sequencing.

Any departure from `AGENTS.md` or a durable decision requires an explicit decision update before tasks are generated.

Exit gate: the implementation approach is complete enough to decompose without task authors inventing architecture.

### 5. Review requirements quality

Create `checklist.md` when ambiguity, destructive behavior, data handling, security, accessibility or broad UX makes an explicit review useful. Checklist items test the quality of requirements, not implementation completion.

The checklist is reviewer-owned. An implementation agent may help evaluate it only when explicitly asked and must never silently mark reviewer items complete. Unchecked blocking items return the change to clarification, specification or planning.

### 6. Decompose and distribute work

Create `task-plan.md`, then create the authoritative task files under `codex-spec/tasks/`.

Each task must:

- deliver one coherent, independently verifiable outcome;
- fit one focused implementation session under normal conditions;
- declare its change ID, prerequisites, scope, non-goals and exact `Read before starting` set;
- map to requirement/scenario IDs and acceptance criteria;
- identify expected contracts/files without claiming ownership of unrelated work;
- include tests and verification proportional to risk;
- state a completion-report format.

Mark tasks parallel only when their prerequisites are complete, they do not edit the same contract/configuration/schema, and integration ownership is explicit. One task owns each shared contract or migration. Parallel work must converge through a named integration task when independently produced results need assembly.

A parallel marker describes technical independence; it does not itself authorize or require spawning multiple agents. The active session's coordination rules and the user's requested mode still apply.

Add the phase/tasks to [implementation-roadmap.md](implementation-roadmap.md) and add `not-started` rows to [post-mvp-task-status.md](post-mvp-task-status.md). The task plan owns dependency and parallel-group relationships; task files own their individual implementation contracts. Do not rewrite the accepted P00-P05 evidence ledger for new work.

Exit gate: every requirement and acceptance scenario maps to at least one task or an explicit manual verification, with no orphan task lacking a requirement or risk rationale.

### 7. Analyze consistency

Before application code changes, perform a read-only cross-artifact review and record it in `analysis.md`. Check:

- requirement-to-task and acceptance-to-test coverage;
- contradictions between proposal, spec, plan, task plan and canonical documents;
- hidden changes to product boundaries, architecture, security/privacy or data compatibility;
- undefined terms, unresolved markers and unmeasurable criteria;
- task overlap, missing dependencies and unsafe parallel groups;
- scope that appears in tasks but not in the specification;
- specification promises with no implementation or verification task.

Grade findings `critical`, `high`, `medium` or `low`. `critical` and `high` findings block `ready`. Fix a finding in the artifact that owns it, then rerun analysis; do not patch contradictions only in the report.

### 8. Implement atomic tasks

Follow [execution-playbook.md](execution-playbook.md). Work on one task per implementation session unless explicitly coordinated parallel work has separate file/contract ownership. Before editing, change the task status to `in-progress`; after implementation, run the task verification and relevant regressions.

An explicit user request to implement authorizes proceeding through nonmaterial choices when the ready gate passes. It does not authorize guessing a material product decision. A request to assess, specify or plan only stops before application code.

If implementation reveals that the plan is wrong, update the owning artifact and rerun affected downstream stages. Do not silently expand a task because nearby work is convenient.

### 9. Converge and close

Compare the resulting code and tests against the current spec, plan and task set. Record:

- delivered behavior and evidence;
- acceptance and requirement coverage;
- commands and results;
- deviations and their approved rationale;
- canonical documents updated;
- residual risks, manual checks and follow-up changes.

If required work is missing, add a new traceable task and return the change to `planned` or `in-progress`. Do not rewrite completed-task history to make the gap disappear. Mark the change `completed` only when its completion record is accurate, required checks pass and all blocking tasks are completed.

## Approval and pause rules

- If the user asks only for assessment or planning, stop at that boundary and do not edit application code.
- A direct request to build a well-bounded change is sufficient approval to create its artifacts and proceed when no material choice remains.
- Pause for explicit user direction when alternatives materially change product scope, destructive behavior, privacy/security posture, data compatibility, recurring cost, external communication or supported-platform commitment.
- Discovery-track `go` decisions require explicit user approval unless the initiating request already chose the evaluated outcome unambiguously.
- Rejection, parking and supersession are recorded outcomes, not deleted history.

## Mid-stream change control

- Before implementation: update the source artifact, then regenerate or revise downstream plan/tasks and rerun analysis.
- During implementation: a clarification that stays within accepted behavior may update the active task and affected artifact together. A new independent outcome receives a new change ID or follow-up task.
- After completion: corrections append a dated note or create a successor change. Do not falsify earlier verification evidence.
- Changes to schema, worker protocol, sanitizer contract, public ports or Markdown pipeline follow the compatibility/version/migration rules in `AGENTS.md` even when discovered late.

## Supported user requests

Natural-language requests are sufficient; no slash command is required. Useful forms are:

```text
Assess this idea and stop before specification: <idea>
```

```text
Specify and plan this change, but do not implement it: <change>
```

```text
Add this feature end to end using the repository change workflow: <feature>
```

```text
Fix this bug. Use the fast track only if it satisfies the documented boundary: <bug>
```

```text
Redesign <surface>. Explore alternatives first and ask only questions that materially change the result.
```

For an existing ready task, use the universal task prompt in the execution playbook.

## Optional future automation

The Markdown workflow is intentionally tool-independent. A future task may add a local scaffolding script, Codex skill or GitHub issue adapter, but it must preserve the paths and authority rules here. Initializing Spec Kit itself requires an explicit decision covering artifact migration, version pinning, generated-file ownership and removal of duplicate sources of truth.
