# CHG-001 Change proposal: Spec-driven change workflow

## Intake

- Requested outcome: establish a durable process for turning future feature, design and technical requests into clarified, analyzed, distributed and verifiable work.
- Request source/date: explicit user request, 2026-10-02.
- Requested mode: implement.
- Affected users/surfaces: repository owner and future coding-agent sessions; no product UI surface.
- Evidence supplied: the accepted MVP has atomic execution tasks but no explicit post-MVP intake path; GitHub Spec Kit was named as a conceptual reference.

## Classification

- Kind: governance.
- Track: standard.
- Why this track: the change is documentation-only but cross-cuts task creation, status, roadmap, requirements and standing agent rules.

## Problem

The repository defines how to execute an existing task but not how a vague new idea becomes an approved specification, technical plan and safe task graph. Future sessions would have to invent this transition, risking inconsistent artifacts, premature implementation and duplicate sources of truth.

## Goals and non-goals

### Goals

- Add explicit discovery and delivery stages with entry and exit gates.
- Preserve the existing canonical documents and atomic `Pxx-Tyy` task model.
- Support both small fixes and high-risk feature work without applying identical ceremony.
- Make task decomposition, safe parallel work, traceability and convergence reproducible.

### Non-goals

- Install or vendor GitHub Spec Kit.
- Create a `.specify` tree, GitHub issues or application runtime behavior.
- Rewrite historical P00-P05 artifacts.

## Evidence

### Supporting evidence

- `codex-spec/execution-playbook.md` begins with selecting an existing unblocked task and has no route for a request without a task.
- Existing task files consistently capture outcome, scope, non-goals, acceptance, tests and verification, providing a strong execution unit to preserve.
- Official GitHub Spec Kit [Idea Assessment](https://github.com/github/spec-kit/tree/main/extensions/assess) separates discovery from delivery, while its [Agentic SDD reference](https://github.github.com/spec-kit/reference/agentic-sdd.html) uses specification, clarification, plan, requirements review, task decomposition, consistency analysis, implementation and convergence stages.

### Evidence against or uncertainty

- A full artifact package would be excessive for a typo or narrow deterministic bug.
- Installing Spec Kit could provide automation, but it would create a parallel specification hierarchy and new tool/version ownership in an already mature repository.
- ASSUMPTION: repository-native Markdown templates are sufficient until repeated use demonstrates a need for scaffolding automation.

## Options and trade-offs

| Option | Value | Cost / risk | Reversibility |
|---|---|---|---|
| Initialize GitHub Spec Kit | Ready-made commands and generated structure | Duplicates `codex-spec`, adds tool/version ownership and unclear migration authority | Medium |
| Adapt the concepts inside `codex-spec` | Preserves history and existing task contracts while adding the missing lifecycle | Requires maintaining local templates and discipline | High |
| Keep the current task-only process | No immediate documentation cost | Every future request invents intake, clarification and planning rules | High but undesirable |

## Decision

- Verdict: go.
- Rationale: adopt a repository-native change lifecycle and templates; do not initialize a competing source of truth.
- Approval evidence: the user explicitly requested a strong process based on GitHub Spec Kit concepts and integration into the existing flow.
- Revisit trigger: repeated manual scaffolding errors or a future explicit decision to migrate all specification authority to a supported tool.

## Handoff to specification

- Problem statement: new work lacks a governed path from informal request to executable task.
- Chosen direction: add change IDs, tracks, artifacts, gates, templates and canonical-document reconciliation under `codex-spec`.
- In scope: intake, clarification, specification, plan, task distribution, analysis, implementation and convergence rules.
- Out of scope: product code, dependencies, external issue creation and historical migration.
- Success signals: a future request can be classified and advanced without inventing process, while small work retains a bounded fast track.
- Carried-forward questions: none blocking.
