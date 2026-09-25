# Markdown Reader

Локальное веб-приложение для импорта и чтения Markdown-файлов. Оно превращает выбранный `.md`-файл в удобный документ с оглавлением, режимами чтения и сохранением позиции — без прикладного backend и отправки содержимого на сервер.

## Что умеет приложение

- Импортировать локальные UTF-8 Markdown-файлы по одному.
- Безопасно отображать CommonMark и GFM, включая код, таблицы, списки задач и сноски.
- Читать документ непрерывной лентой или по разделам со стратегиями `auto`, `H1`, `H2`, `H3` и `whole`.
- Строить оглавление по заголовкам `H1–H3` и открывать ссылки на конкретный заголовок.
- Сохранять прогресс и возвращать пользователя к последнему смысловому месту.
- Распознавать точные дубликаты и управляемо заменять изменённую версию файла.
- Хранить локальную библиотеку документов в браузере.
- Работать на desktop и mobile, поддерживать светлую и тёмную темы.
- После первого успешного запуска открывать ранее сохранённые документы без сети.

Поддержка больших файлов остаётся обязательным техническим сценарием, но приложение не ограничено длинными публикациями: оно предназначено для любых поддерживаемых Markdown-документов.

## Технологический стек

- `React 19.2` с совместимым stable patch + `TypeScript` в strict-режиме;
- `Vite 8.1` для разработки и сборки;
- `React Router 8` в Declarative mode для маршрутов библиотеки и документа;
- `shadcn/ui` на базе React Aria + `Tailwind CSS` для интерфейса;
- `Dexie` + IndexedDB для локального хранения;
- `unified` / `remark` / `rehype` для Markdown pipeline;
- `lowlight` для безопасной подсветки кода;
- Web Worker для ресурсоёмкой обработки;
- PWA app shell для повторного offline-запуска.

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

Для локального запуска понадобятся Node.js `22.22` или новее и pnpm `11.25`.

```sh
pnpm install
pnpm dev
```

После запуска откройте адрес, который покажет Vite (обычно `http://localhost:5173`).

Чтобы проверить production-сборку локально:

```sh
pnpm build
pnpm preview
```

## Структура проекта

- `src/` — исходный код приложения:
  - `app/` — точка сборки приложения и общие сервисы;
  - `application/` — сценарии использования и интерфейсы между слоями;
  - `domain/` — модели и бизнес-правила без привязки к React и браузерному хранилищу;
  - `features/` — пользовательские функции: библиотека, импорт и чтение;
  - `infrastructure/` — работа с IndexedDB, браузерными API и PWA;
  - `shared/` — общие ресурсы, включая локализацию;
  - `styles/` — глобальные стили приложения и документов;
  - `test/` — общая тестовая инфраструктура, фикстуры и тестовые наборы;
  - `ui/` — переиспользуемые компоненты интерфейса и темы;
  - `workers/` — фоновая обработка Markdown.
- `public/` — статические файлы, иконки и настройки хостинга.
- `e2e/` — браузерные сценарии Playwright.
- `docs/` — отчёты по проверкам и технические материалы.
- `codex-spec/` — требования, архитектурные решения и задачи проекта.
- `tools/` — внутренние инструменты разработки.

## Документация для разработки

- [AGENTS.md](AGENTS.md) — постоянные правила работы Codex и навигация по source of truth.
- [codex-spec/README.md](codex-spec/README.md) — карта требований, архитектуры, дизайна, feature-spec, roadmap и задач.
- [project-source-of-truth.md](codex-spec/project-source-of-truth.md) — границы продукта и MVP.
- [implementation-roadmap.md](codex-spec/implementation-roadmap.md) — последовательность вертикальных этапов.
- [pipeline-spike.md](docs/benchmarks/pipeline-spike.md) — результаты P00-T02 по corpus, security, limits и grammar policy.
- [production-pipeline.md](docs/benchmarks/production-pipeline.md) — принятые P02-T01 production limits, протокол, fallbacks и regression evidence.
- [virtual-reader-spike.md](docs/benchmarks/virtual-reader-spike.md) — результаты P00-T04 по виртуализации, bounded cache, focus и browser matrix.
- [progress-mapping-spike.md](docs/benchmarks/progress-mapping-spike.md) — результаты P00-T05 по semantic anchors, confidence policy и update pairs.
- [progress-persistence.md](docs/benchmarks/progress-persistence.md) — принятые правила semantic progress, throttling, flush и восстановления P03-T04.
- [release-candidate-2026-09-25.md](docs/release-candidate-2026-09-25.md) — финальная проверка MVP, release-команды, ограничения, waivers и deployment handoff.
- [tasks/](codex-spec/tasks/) — атомарные задания для реализации по одному.
