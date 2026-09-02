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

## Universal start prompt

```text
Выполни ровно задачу <TASK_FILE> в этом репозитории.

Сначала полностью прочитай корневой AGENTS.md, затем <TASK_FILE> и перечисленные в нём Read before starting. До изменений изучи фактическую структуру проекта, package.json/lockfile, git status/diff, выполненные зависимости задачи и существующие тесты. Не повторяй уже готовую работу и не перезаписывай пользовательские изменения.

Реализуй Scope и acceptance criteria задачи, соблюдая Non-goals и архитектурные/security/UI границы. Не принимай молча фундаментальные решения и не меняй стек. Если документация существенно расходится с кодом или не хватает блокирующего решения, остановись и опиши конкретное расхождение.

Добавь Required tests, выполни Verification и релевантный regression suite. Не объявляй задачу завершённой при падающих обязательных проверках.

В конце дай Completion report: outcome; изменённые файлы; выполненные команды и результаты; закрытые acceptance criteria; отклонения от спецификации; остаточные риски/блокеры; следующий разблокированный task ID.
```

Пример первого запуска: заменить `<TASK_FILE>` на `codex-spec/tasks/P00-T01-project-bootstrap.md`.
