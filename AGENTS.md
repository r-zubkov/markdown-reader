# Постоянные правила Codex

## Цель

Разрабатывать локальную browser-only читалку Markdown-файлов как безопасный, отзывчивый и доступный production-oriented MVP. Код обязан сохранять весь контент документа, локальность данных и semantic reading position.

## Перед любой задачей

1. Прочитать этот файл, конкретный task-файл из `codex-spec/tasks/` и его `Read before starting`.
2. Проверить реальную структуру репозитория, `package.json`, lockfile, текущий git diff и уже завершённые task IDs.
3. Не повторять выполненную работу и не перезаписывать пользовательские изменения.
4. Если код и спецификация расходятся существенно, остановиться и описать расхождение; не делать молчаливый выбор.

Приоритет: последняя явная инструкция пользователя → безопасность/целостность → `codex-spec/requirements-and-decisions.md` → task → feature spec → architecture/design/data docs → рабочее предположение.

Все пути в спецификациях считаются относительно корня репозитория.

## Карта спецификаций

- Навигатор и порядок исполнения: `codex-spec/README.md`.
- Продукт и границы MVP: `codex-spec/project-source-of-truth.md`.
- Требования, решения и трассировка: `codex-spec/requirements-and-decisions.md`.
- Архитектура и данные: `codex-spec/architecture/`.
- UI-система, экраны и flows: `codex-spec/design/`.
- Функциональные контракты: `codex-spec/features/`.
- Атомарные задания: `codex-spec/tasks/`.
- Порядок этапов: `codex-spec/implementation-roadmap.md`.
- Качество и финальная приёмка: `codex-spec/testing-and-quality.md` и `codex-spec/final-acceptance-checklist.md`.

Корневой `README.md` предназначен для людей: кратко объясняет продукт, фактический статус и реальные команды запуска. Не превращать его в дубликат спецификаций. Все исполнительные документы, кроме этого файла, должны оставаться внутри `codex-spec/`.

## Архитектурные границы

- `domain` — чистый TypeScript; не импортирует React, DOM, Dexie, router или PWA APIs.
- `infrastructure` реализует repository/platform ports; UI не обращается к IndexedDB или service worker напрямую.
- `workers` не импортируют React/UI и общаются через versioned discriminated-union protocol.
- `features/*` оркестрируют use cases и UI; business rules не живут в визуальных компонентах.
- В React state/Context запрещено хранить полный исходник, AST, все chunks или весь документ. IndexedDB — source of truth для persistent data.
- `SafeHtmlChunk` — единственная точка `dangerouslySetInnerHTML`. Она принимает только `SanitizedHtml`, выданный repository после проверки `pipelineVersion`.
- User-visible split strategy не отключает internal chunking. `whole` означает один логический раздел, а не гигантский DOM.
- Import/replace всегда используют staging + atomic commit. Ошибка не может опубликовать partial document или повредить текущую ready version.

Запрещены незапрошенные backend, auth, sync, telemetry содержимого, SSR/RSC, MDX, raw executable HTML, Redux/Zustand/TanStack Query, custom parser/sanitizer/IndexedDB wrapper и массовый рефакторинг.

## Стек и зависимости

- React 19.2 с текущим совместимым security patch, TypeScript strict, Vite 8.1, React Router 8 Declarative Mode, Node `>=22.22`.
- Dexie 4, unified/remark/rehype pipeline, lowlight, Web Worker, TanStack Virtual v3, `vite-plugin-pwa` `generateSW`.
- UI: shadcn/ui с React Aria base, Tailwind CSS 4 для shell, CSS custom properties и namespaced `.reader-content` CSS; Lucide React.
- `pnpm` и lockfile — рабочее предположение, закрепляемое bootstrap task.
- Новая dependency требует конкретной ответственности, проверки лицензии/совместимости и записи в completion report. Нельзя менять стек из-за личного предпочтения.
- Использовать стабильные релизы и фиксировать resolved versions lockfile. Не придумывать patch-версии: на bootstrap проверить peer/minimum requirements официальной документации.

## TypeScript и контракты

- `strict` включён; избегать `any`, non-null assertions и unchecked casts на trust boundaries.
- Внешние данные и persisted records валидируются до использования. Domain errors — discriminated unions с стабильными codes; UI переводит code в русскую microcopy.
- ID — `crypto.randomUUID()`. Времена — UTC epoch milliseconds. Ratios ограничены `[0,1]`.
- Derived state вычисляется из канонического source; не создавать второй источник истины для progress, mode или current version.
- Изменение IndexedDB schema, worker protocol, sanitizer contract или публичного port interface требует обновить соответствующий spec/decision, миграционный тест и совместимость.
- Изменение Markdown/sanitize/highlight pipeline требует `PIPELINE_VERSION` bump и проверенный rebuild из `sourceBlob`.

## React, UI и стили

- Pages композируют feature components; reusable primitives находятся в `src/ui/primitives`.
- Не переустанавливать shadcn component поверх локально изменённой версии без diff review. Не смешивать Radix/Base UI/React Aria implementations без `DEC`.
- Feature-код использует semantic tokens, не raw hex. Tailwind не должен управлять внутренней разметкой sanitized Markdown.
- `.reader-content` изолирован namespace/layer; code/table/image не создают page-level horizontal overflow.
- Light/dark/system, keyboard, focus return, 320 px reflow, reduced motion и 44×44 touch targets обязательны для затронутых UI.
- Ссылки используются для navigation, buttons — для actions. Не делать интерактивный container с вложенными controls.
- Все loading/empty/error/offline/disabled states берутся из screen/feature spec; нельзя заменять actionable error одним toast.

## Безопасность и приватность

- File, Markdown, raw HTML, URL, language label и persisted bytes недоверенны.
- Raw HTML не исполняется. Sanitizer — runtime boundary; TypeScript brand не является защитой.
- Блокировать event handlers, inline style, executable/embed tags, DOM-clobbering IDs и unsafe protocols. External image policy и CSP должны совпадать.
- Содержимое документа не отправляется в сеть и не логируется. Remote HTTPS images — единственное разрешённое обращение к third-party content и управляются preference/policy.
- Не добавлять secrets. Пользовательские diagnostics не включают текст документа.

## Проверки и завершение

После изменения запустить проверки task-файла и релевантный regression suite. Базовый gate после bootstrap: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; E2E/a11y/performance — когда требует task.

Задача не завершена, если обязательная проверка падает, acceptance criterion не доказан или остался скрытый blocker. Completion report перечисляет:

- изменённые файлы и фактический outcome;
- выполненные команды с результатом;
- acceptance criteria;
- отклонения от спецификации и причины;
- residual risks/следующий task.

Обновлять task status или roadmap только подтверждённым фактом. Не отмечать phase gate зелёным по одной компиляции. Если меняются публичное поведение, архитектурный контракт, схема или подтверждённые команды, синхронно обновить соответствующий файл в `codex-spec/`; корневой README обновлять только фактами, полезными пользователю или разработчику при обычном знакомстве с проектом.
