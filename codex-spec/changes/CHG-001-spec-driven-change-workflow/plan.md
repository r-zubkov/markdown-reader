# CHG-001 Implementation plan: Spec-driven change workflow

## Repository baseline

- Current behavior and evidence: `execution-playbook.md` executes an already-created task; `tasks/` has a consistent atomic shape; the roadmap and accepted-MVP status cover completed P00-P05 work; no intake template, change registry, post-MVP task ledger or per-change directory convention exists.
- Relevant existing contracts: `AGENTS.md` standing rules, canonical-document map, phase roadmap, task status table and task-file structure.
- Working-tree considerations: the worktree was clean before creating P06-T01; preserve all accepted MVP evidence.

## Chosen design

Add one project-native lifecycle document and registry, a `changes/` directory for standard/discovery packages, reusable templates, a P06 governance phase and concise standing-rule/playbook integration. Keep executable task authority in the existing per-task files.

## Alternatives rejected

| Alternative | Reason not selected |
|---|---|
| Initialize GitHub Spec Kit and `.specify` | Creates overlapping specification authority and new tooling/version ownership without migrating the existing system. |
| Put the entire process only in `AGENTS.md` | Makes the standing rules too large and provides no per-change artifacts or templates. |
| Require a full package for every edit | Adds disproportionate ceremony to small deterministic changes. |

## Impact map

| Area | Expected change | Contract owner |
|---|---|---|
| Domain / use cases | None | Not applicable |
| Data / migrations | None | Not applicable |
| Worker / pipeline | None | Not applicable |
| UI / routes / state | None | Not applicable |
| Security / privacy | Governance gates only | `AGENTS.md` and change workflow |
| PWA / platform | None | Not applicable |
| Documentation | New lifecycle, registry, templates and P06 reconciliation | P06-T01 |

## Compatibility and recovery

- Existing persisted data: unaffected.
- Version/migration/rebuild: unaffected.
- Failure atomicity and rollback: documentation-only; partial work remains visible in git and registry state.
- Interrupted-session recovery: the active task, registry state and package artifacts identify the first unmet gate.

## UX and quality plan

- Responsive/accessibility/localization: no product UI change; documentation remains English-only.
- Loading/empty/error/offline states: not applicable to product UI.
- Performance budgets: not applicable.

## Dependencies

None. No package or CLI is added.

## Test and verification strategy

- Documentation: local Markdown link audit and template/traceability review.
- Repository integrity: `git diff --check`, final diff inspection and confirmation that no application or dependency file changed.
- Application regressions: not required because no runtime file changes.

## Canonical document updates

- `AGENTS.md`
- `codex-spec/README.md`
- `codex-spec/requirements-and-decisions.md`
- `codex-spec/implementation-roadmap.md`
- `codex-spec/post-mvp-task-status.md`
- `codex-spec/execution-playbook.md`

## Task decomposition strategy

One documentation/governance task is sufficient. All changed contracts are documentation contracts owned by P06-T01, so parallel task execution would create unnecessary overlap.
