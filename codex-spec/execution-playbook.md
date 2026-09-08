# Codex execution playbook

## One task per session

1. Select the next unblocked task from `codex-spec/implementation-roadmap.md`.
2. Read root `AGENTS.md`, the task and only its `Read before starting` references.
3. Inspect actual repository tree, `package.json`, lockfile, git status/diff, completed reports/tests and task dependencies.
4. State any mismatch before editing. Do not recreate completed work or silently reinterpret a contract.
5. Implement only Scope; keep Non-goals out. Reuse established ports/primitives/fixtures.
6. Add required tests and run task Verification plus relevant regression.
7. If a required check fails, fix it within scope or report blocker; never mark complete.
8. Give the exact Completion report required by the task.

## Documentation language

`AGENTS.md` and every file under `codex-spec/` must remain English-only execution documentation. Describe Russian UI locale requirements in English; do not add literal non-English UI labels, prompts or prose to these files.

## Status convention

Until code repository establishes its own tracker, completion is evidenced by code/tests/report, not by editing the task checkbox. When the first implementation session needs persistent status, it creates a single repository file `codex-spec/implementation-status.md` with:

```md
| Task | Status | Commit/worktree evidence | Checks | Deviations |
|---|---|---|---|---|
```

Allowed states: `not-started`, `in-progress`, `blocked`, `completed`. Only one task should normally be `in-progress` per Codex session.

## Interrupted session

On resume:

1. Inspect working tree and previous completion/progress note.
2. Run the smallest relevant check before new edits.
3. Match existing changes to Scope/AC and continue from first unmet criterion.
4. Do not discard partial/user changes or restart scaffolding.
5. If partial state is unsafe (migration/protocol half-change), stabilize it within current task before proceeding.

## Documentation/code mismatch

- If code merely uses a different path/name with the same contract, follow repository convention and mention it.
- If mismatch changes behavior, schema, security, public port or phase scope, stop and propose exact update to `codex-spec/requirements-and-decisions.md`, the relevant decision and task before implementation.
- For a measured PoC result, update DFR/DEC, central config and dependent task notes together.
- Latest actual `package.json` commands override greenfield target commands only after the documentation is updated to match.

## Regression selection

Always run typecheck/lint and tests directly touched. Additionally:

- pipeline/policy/version → security corpus + import integration + build;
- schema/repository → migration/atomicity + import/read/delete regression;
- reader/location/layout → large-reader + TOC/mode/reload E2E;
- primitive/theme/responsive → component a11y + affected screenshots/viewports;
- PWA → production build/offline/update isolated-profile E2E.

## Playwright in Windows/Codex sandbox

If a Playwright test passes but its managed `webServer` hangs during teardown only in the Windows/Codex sandbox:

1. Treat the hang as environment-specific until it reproduces in a normal terminal.
2. Keep `playwright.config.ts` and normal Playwright/CI behavior unchanged.
3. Start Vite separately and let Playwright use `reuseExistingServer`.
4. Record and verify the exact Vite PID before running the test.
5. After the test, terminate only that PID and confirm its listener is gone. Never terminate all `node.exe` processes.
6. Change the normal Playwright/CI flow only after the same teardown failure is reproduced outside Codex.

## Universal start prompt

```text
Complete exactly the task <TASK_FILE> in this repository.

First read the root AGENTS.md completely, then <TASK_FILE> and the documents listed in its Read before starting section. Before making changes, inspect the actual project structure, package.json/lockfile, git status/diff, completed task dependencies and existing tests. Do not repeat already completed work and do not overwrite user changes.

Implement the task Scope and acceptance criteria while respecting Non-goals and the architectural/security/UI boundaries. Do not silently make fundamental decisions and do not change the stack. If documentation substantially differs from code or a blocking decision is missing, stop and describe the specific mismatch.

Add Required tests, run Verification and the relevant regression suite. Do not declare the task complete when required checks fail.

At the end, provide a Completion report: outcome; changed files; commands run and results; closed acceptance criteria; deviations from specification; residual risks/blockers; next unblocked task ID.
```

First-run example: replace `<TASK_FILE>` with `codex-spec/tasks/P00-T01-project-bootstrap.md`.
