# Project source of truth

## Проблема и ценность

Markdown-файлы неудобно долго читать в редакторе, а прямой рендер крупного документа в единый HTML создаёт тяжёлый DOM и не сохраняет читательский контекст. Продукт импортирует локальный UTF-8 `.md`, безопасно превращает его в оформленный документ, сохраняет в браузере и возвращает пользователя к последнему смысловому месту — без backend и отправки содержимого на сервер.

## Пользователь и контекст

Одна роль: владелец локальной библиотеки Markdown-документов в текущем browser profile/origin. Desktop и mobile равноприоритетны. Поддерживается любой валидный Markdown-файл в границах подтверждённых лимитов; важный stress case — крупные технические документы с кодом, таблицами, длинными списками, ссылками, сносками и неоднородной структурой heading.

## Канонические сценарии MVP

1. Открыть библиотеку, выбрать ровно один `.md`, видеть честные этапы обработки и отменить до commit.
2. После успешной атомарной финализации увидеть документ вверху списка и открыть его.
3. Читать весь документ как CommonMark + GFM с подсветкой безопасно распознанного кода.
4. Перейти через глобальное оглавление `H1–H3` в continuous или sections mode.
5. Переключить mode/strategy, оставаясь у того же semantic anchor.
6. Закрыть/reload и продолжить с точного либо явно обозначенного приблизительного места.
7. Не создать точный дубликат; для похожего изменённого файла выбрать replace, separate или cancel.
8. Удалить документ только после подтверждения.
9. После первого online visit запустить app shell offline и читать уже сохранённые документы.

## Граница MVP

- Browser-only SPA/PWA, статическая раздача по HTTPS.
- React UI; чистые TypeScript domain/pipeline modules; Web Worker для тяжёлой обработки.
- Локальная IndexedDB-библиотека, исходный Blob, versioned derived chunks и reader state.
- Continuous virtual reader и sections reader.
- Split strategies: `auto`, `h1`, `h2`, `whole`; internal safe chunks работают всегда.
- Auto initial mode: документ с низкой измеренной стоимостью рендера — continuous, с высокой — sections; threshold определяется PoC и применяется только до явного выбора пользователя.
- Semantic progress, full-document TOC, duplicate/update/delete, storage/recovery states.
- Светлая, тёмная и системная theme preference; русский UI; WCAG 2.2 AA baseline.
- HTTPS remote images по privacy policy; относительные локальные ресурсы не импортируются.

## Ключевые продуктовые правила

- Ни один режим не обрезает и не теряет содержимое. Paragraph/list/table/quote/code block не разрывается посередине; огромный неделимый node получает безопасный fallback.
- `whole` — один логический navigation section, но не отключение chunking/virtualization.
- Split strategy определяет sections layout. В continuous mode она сохраняется как настройка будущего перехода, не меняя визуальную модель единой ленты.
- Обычное открытие восстанавливает saved anchor; явный URL hash heading имеет приоритет и затем становится новой текущей позицией.
- Exact duplicate определяется SHA-256 исходных bytes. Filename/title — только эвристика возможного update; последнее слово за пользователем.
- Replace сохраняет `documentId`, старую ready version до commit и пытается map progress: exact → approximate → start with notice.
- Название: первый `H1`, иначе filename без расширения. Повторяющиеся headings получают детерминированные уникальные IDs.
- Library стартует на `/`, сортируется по последней активности, stable tie-breaker — `documentId`.
- Успешный import остаётся в library и предлагает «Открыть документ»; это обратимое UX assumption `ASM-002`.
- Raw HTML показывается как inert escaped content; никогда не исполняется.

## После MVP

Приоритет: backup/export + restore → full-document search → typography controls → bookmarks → notes/collections → local asset packages → optional sync. Каждая возможность требует отдельной схемы/feature spec.

## Явно исключено

Backend, accounts, cloud sync, cross-device transfer, server analytics, search в MVP, editing/authoring, MDX, executable HTML, Mermaid/LaTeX/plugins, folders/archives, linked local images, notes/bookmarks/tags, SSR/RSC, desktop shell, AI и store/catalog.

## Ограничения

- Storage origin-scoped, quota/eviction управляются браузером; исходный файл должен оставаться у пользователя. MVP не обещает backup.
- Максимальный file size, chunk cost, DOM window, overscan, supported highlight grammars и anchor tolerance фиксируются только после PoC.
- Tailwind CSS 4 задаёт технический browser floor Safari 16.4+, Chrome 111+, Firefox 128+; release target — текущие стабильные desktop Chromium/Firefox/Safari и mobile Safari/Chrome при соблюдении floor.
- First visit без сети не поддерживается. После успешной установки app shell работает offline.

## Глоссарий

| Термин | Каноническое значение |
|---|---|
| Document | Стабильная пользовательская запись импортированного Markdown-файла |
| Document version | Один импорт исходных bytes документа и его derived data |
| Source blob | Оригинальные bytes `.md`, достаточные для rebuild |
| Chunk | Внутренняя безопасная render-единица между top-level AST nodes |
| Section | Пользовательская navigation-часть layout; содержит один или несколько chunks |
| Outline | Иерархия `H1–H3` всей версии |
| Reading mode | `continuous` или `sections` |
| Split strategy | `auto`, `h1`, `h2`, `whole` |
| Semantic anchor | Heading path + block location + ratios для восстановления позиции |
| Ready version | Единственная опубликованная текущая версия документа |
| Staging version | Неполный импорт, невидимый как документ до commit |
| Pipeline version | Версия алгоритма parse/sanitize/highlight/serialization |
| Exact restore | Восстановление того же semantic block с высокой уверенностью |
| Approximate restore | Fallback по heading/overall ratio с видимым уведомлением |
