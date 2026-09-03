# Codex specification

Этот каталог — исполнительный source of truth для поэтапной разработки Markdown Reader. Корневой `README.md` описывает продукт для людей; здесь находятся требования, инженерные решения, UX-контракты, roadmap и атомарные задачи coding-agent.

## Канонические документы

| Документ | Каноничен для |
|---|---|
| [project-source-of-truth.md](project-source-of-truth.md) | Проблемы, пользователей, MVP, post-MVP и non-goals |
| [requirements-and-decisions.md](requirements-and-decisions.md) | Requirement IDs, конфликтов, решений, assumptions и трассировки |
| [architecture/system-architecture.md](architecture/system-architecture.md) | Модулей, зависимостей, runtime flows, интеграций и trust boundaries |
| [architecture/data-and-state.md](architecture/data-and-state.md) | Сущностей, IndexedDB, state ownership, сериализации и миграций |
| [design/ui-design-system.md](design/ui-design-system.md) | UI stack, токенов, компонентов, тем, responsive и accessibility rules |
| [design/screens-and-user-flows.md](design/screens-and-user-flows.md) | Экранов, overlays, состояний, переходов и screen acceptance |
| [features/](features/) | Функциональных контрактов, edge cases и feature-level tests |
| [testing-and-quality.md](testing-and-quality.md) | Стратегии тестирования, corpus, команд и Definition of Done |
| [implementation-roadmap.md](implementation-roadmap.md) | Фаз, зависимостей, gates и доступного после каждой фазы продукта |
| [implementation-status.md](implementation-status.md) | Текущий persistent статус task-выполнения |
| [tasks/](tasks/) | Атомарных исполнимых заданий Codex |
| [execution-playbook.md](execution-playbook.md) | Правил запуска и продолжения task-сессий |
| [final-acceptance-checklist.md](final-acceptance-checklist.md) | Финальной приёмки MVP |

## Feature specifications

- `F00` — [risk-spikes.md](features/risk-spikes.md): обязательные технические PoC;
- `F01` — [import-and-library.md](features/import-and-library.md): импорт и библиотека;
- `F02` — [markdown-pipeline.md](features/markdown-pipeline.md): parsing, chunking, sanitize и highlight;
- `F03` — [continuous-reader.md](features/continuous-reader.md): bounded continuous reader;
- `F04` — [sections-toc-progress.md](features/sections-toc-progress.md): sections, TOC и semantic position;
- `F05` — [document-lifecycle.md](features/document-lifecycle.md): duplicate, replace и delete;
- `F06` — [pwa-storage-platform.md](features/pwa-storage-platform.md): PWA, storage health, themes и platform states.

## Порядок чтения

1. Всегда начать с корневого [AGENTS.md](../AGENTS.md).
2. При первом входе в проект прочитать `project-source-of-truth.md`, `requirements-and-decisions.md`, `architecture/system-architecture.md` и `implementation-roadmap.md`.
3. Выбрать следующий разблокированный task и прочитать только перечисленные в нём `Read before starting` документы.
4. До изменений сверить спецификацию с реальным `package.json`, lockfile, кодом, git diff и результатами завершённых задач.
5. Выполнить одну задачу, пройти её verification и выдать completion report.

Завершены первые tasks: [P00-T01-project-bootstrap.md](tasks/P00-T01-project-bootstrap.md) и [P00-T02-content-pipeline-spike.md](tasks/P00-T02-content-pipeline-spike.md). Следующие разблокированные задачи P00: `P00-T03`, `P00-T04`, `P00-T05`, `P00-T06`; рекомендуемый следующий task — [P00-T03-storage-atomicity-spike.md](tasks/P00-T03-storage-atomicity-spike.md).

## Именование

Обычные документы имеют смысловые имена без порядковых префиксов: порядок задают этот навигатор и roadmap. Feature ID сохраняется внутри feature-spec и в трассировке. Task ID вида `P03-T04` сохраняется и в имени файла, потому что является стабильным ключом зависимости, отчёта и phase gate; текстовая часть имени остаётся человекопонятной.

## Статус

Комплект спецификаций: `COMPLETE · QA PASSED`. Реализация: `P00-T01/P00-T02 COMPLETE · P00 SPIKES CONTINUE`. Завершённые task IDs: `P00-T01`, `P00-T02`. Целевые команды P00-T02 прошли verification; pipeline limits остаются P00 proposal до production/browser rerun.
