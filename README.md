# Markdown Reader

Локальное веб-приложение для импорта и чтения Markdown-файлов. Оно превращает выбранный `.md`-файл в удобный документ с оглавлением, режимами чтения и сохранением позиции — без прикладного backend и отправки содержимого на сервер.

## Что умеет приложение

- Импортировать локальные UTF-8 Markdown-файлы по одному.
- Безопасно отображать CommonMark и GFM, включая код, таблицы, списки задач и сноски.
- Читать документ непрерывной лентой или по разделам.
- Строить оглавление по заголовкам `H1–H3` и открывать ссылки на конкретный заголовок.
- Сохранять прогресс и возвращать пользователя к последнему смысловому месту.
- Распознавать точные дубликаты и управляемо заменять изменённую версию файла.
- Хранить локальную библиотеку документов в браузере.
- Работать на desktop и mobile, поддерживать светлую и тёмную темы.
- После первого успешного запуска открывать ранее сохранённые документы без сети.

Поддержка больших файлов остаётся обязательным техническим сценарием, но приложение не ограничено длинными публикациями: оно предназначено для любых поддерживаемых Markdown-документов.

## Технологический стек

Целевой стек, зафиксированный в спецификации:

- `React 19.2` с совместимым stable patch + `TypeScript` в strict-режиме;
- `Vite 8.1` для разработки и сборки;
- `React Router 8` в Declarative mode для маршрутов библиотеки и документа;
- `shadcn/ui` на базе React Aria + `Tailwind CSS` для интерфейса;
- `Dexie` + IndexedDB для локального хранения;
- `unified` / `remark` / `rehype` для Markdown pipeline;
- `lowlight` для безопасной подсветки кода;
- Web Worker для ресурсоёмкой обработки;
- PWA app shell для повторного offline-запуска.

Точные совместимые версии фиксируются lockfile во время bootstrap, а не придумываются заранее.

Bootstrap P00-T01 зафиксировал базовый runtime/toolchain: Node `v24.20.0`, `pnpm@11.25.0`, React `19.2.8`, React DOM `19.2.8`, React Router `8.3.1`, Vite `8.1.5`, TypeScript `6.0.3`, ESLint `10.9.1`, Vitest `4.1.11`, Playwright `1.62.1`.

## Архитектура

Приложение разделено на следующие области:

- `domain` — сущности, правила и независимые от платформы типы;
- `application` — пользовательские сценарии и порты;
- `infrastructure` — IndexedDB и реализации repository;
- `workers` — импорт, parsing, chunking, sanitize и highlight;
- `features` — библиотека, импорт, чтение, оглавление и жизненный цикл документа;
- `ui` — общие компоненты и визуальные primitives.

UI не хранит полный Markdown-корпус. Persistent source of truth находится в IndexedDB, а визуальные компоненты работают через application use cases и ограниченные выборки данных.

## Приватность и хранение

Исходные файлы, производные данные, настройки и прогресс хранятся в IndexedDB текущего browser profile. В MVP нет аккаунтов, облачной синхронизации и аналитики содержимого. Внешние HTTPS-изображения — единственное разрешённое обращение к стороннему content endpoint, и его можно отключить.

Браузер может очистить origin storage, поэтому оригинальные `.md`-файлы следует сохранять отдельно. Backup/export запланирован после MVP.

## Быстрый старт

Bootstrap [P00-T01: Project bootstrap](codex-spec/tasks/P00-T01-project-bootstrap.md) завершён: в репозитории есть `package.json`, `pnpm-lock.yaml`, Vite/React entry, строгие TS-конфиги, ESLint foundation, Vitest setup и Playwright config.

Pipeline spike [P00-T02: Content pipeline and limits spike](codex-spec/tasks/P00-T02-content-pipeline-spike.md) завершён: добавлены prototype modules для Markdown pipeline, deterministic corpus, security/bench tests и [pipeline-spike report](docs/benchmarks/pipeline-spike.md). Лимиты пока являются P00 proposal, а не release SLA.

Проверенная среда:

- Node `>=22.22.0`;
- Corepack с `pnpm@11.25.0` из `packageManager`.

Проверенные команды:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm test:security
corepack pnpm test:bench
corepack pnpm build
corepack pnpm test:e2e:list
```

В Codex sandbox эти команды запускались с `COREPACK_HOME=.corepack`, чтобы Corepack cache оставался внутри рабочей папки.

## Документация для разработки

- [AGENTS.md](AGENTS.md) — постоянные правила работы Codex и навигация по source of truth.
- [codex-spec/README.md](codex-spec/README.md) — карта требований, архитектуры, дизайна, feature-spec, roadmap и задач.
- [project-source-of-truth.md](codex-spec/project-source-of-truth.md) — границы продукта и MVP.
- [implementation-roadmap.md](codex-spec/implementation-roadmap.md) — последовательность вертикальных этапов.
- [pipeline-spike.md](docs/benchmarks/pipeline-spike.md) — результаты P00-T02 по corpus, security, limits и grammar policy.
- [tasks/](codex-spec/tasks/) — атомарные задания для реализации по одному.

## Текущий статус

- Спецификация: `COMPLETE · QA PASSED`.
- Реализация: `P00-T01/P00-T02 COMPLETE · P00 SPIKES CONTINUE`.
- Завершённые task IDs: `P00-T01`, `P00-T02`.
- Следующие разблокированные задачи: `P00-T03`, `P00-T04`, `P00-T05`, `P00-T06`.

## Текущая структура репозитория

```text
README.md
AGENTS.md
package.json
pnpm-lock.yaml
index.html
vite.config.ts
vitest.config.ts
vitest.security.config.ts
vitest.bench.config.ts
playwright.config.ts
eslint.config.mjs
tsconfig.json
tsconfig.app.json
tsconfig.worker.json
tsconfig.test.json
tsconfig.node.json
.npmrc
codex-spec/
  architecture/
  design/
  features/
  tasks/
  README.md
  project-source-of-truth.md
  requirements-and-decisions.md
  testing-and-quality.md
  implementation-roadmap.md
  implementation-status.md
  execution-playbook.md
  final-acceptance-checklist.md
docs/
  benchmarks/
    pipeline-spike.md
src/
  app/
  domain/
    content/
  main.tsx
  styles/
  test/
    bench/
    corpus/
    security/
  workers/
tools/
  eslint-rules/
e2e/
```

Эта структура отражает bootstrap foundation и P00-T02 pipeline spike. Производственные feature-модули, IndexedDB schema, shadcn primitives и PWA shell добавляются последующими task-файлами.
