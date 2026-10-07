# Change packages

This directory stores standard- and discovery-track change artifacts governed by [the change workflow](../change-workflow.md). Fast-track work is normally documented inline in its atomic task and linked from [the change registry](../change-registry.md).

## Directory naming

Use `CHG-NNN-short-name/`, where the ID already exists in the registry and the slug is lowercase ASCII with hyphens. Never rename the numeric ID or reuse a closed directory.

## Standard package

```text
CHG-NNN-short-name/
  proposal.md
  spec.md
  plan.md
  task-plan.md
  analysis.md
  completion.md
  checklist.md        # optional or risk-required
```

Start from [the repository templates](../templates/). The package is not a second copy of canonical product or architecture documents: when a durable rule changes, update its canonical owner and link to that update.

## Ownership

- `proposal.md` owns intake, assessment and the delivery decision.
- `spec.md` owns change-local behavior and success criteria.
- `plan.md` owns technical implementation choices for the change.
- `task-plan.md` owns task ordering, dependencies and parallel groups.
- atomic files in `codex-spec/tasks/` own executable scope and verification.
- `analysis.md` records read-only consistency findings.
- `completion.md` records convergence and delivery evidence.
- `checklist.md`, when present, is a reviewer-owned requirements-quality gate.
