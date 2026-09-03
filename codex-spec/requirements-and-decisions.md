# Requirements and decisions

## Source precedence used

1. Последние явные решения пользователя: продукт — веб-читалка Markdown-файлов, а не специализированная читалка длинных изданий; desktop/mobile равноприоритетны; light/dark; technical editorial.
2. Security, data integrity и фактические platform constraints.
3. Technical blueprint — implementation.
4. Product blueprint — behavior/scope.
5. Design blueprint — UX/presentation; как более поздний документ он уточняет UI stack.
6. Reversible assumptions этого комплекта.

## Нормализованные требования

### Product

| ID | Проверяемое правило | Source |
|---|---|---|
| PRD-001 | Приложение работает без прикладного backend; Markdown-документы и прогресс остаются в текущем origin/profile. | SOURCE |
| PRD-002 | Import принимает ровно один `.md`, проверяет UTF-8 и не публикует документ до полного успеха. | SOURCE |
| PRD-003 | Library переживает reload, показывает title/progress и позволяет открыть/продолжить документ. | SOURCE |
| PRD-004 | Reader отображает CommonMark + GFM, включая tables, task lists, footnotes и fenced code. | SOURCE |
| PRD-005 | Outline всего документа содержит иерархию `H1–H3`; выбор heading приводит к нему в любом режиме. | SOURCE |
| PRD-006 | Continuous mode выглядит как единая лента без «загрузить ещё» и не монтирует весь крупный документ. | SOURCE |
| PRD-007 | Sections mode показывает одну логическую часть, pager и `Раздел N из M · Название`. | SOURCE |
| PRD-008 | До явного выбора пользователя initial mode определяется измеренным порогом размера/стоимости документа. | SOURCE + DERIVED |
| PRD-009 | Доступны strategies `auto/h1/h2/whole`; они определяют section layout, но не отключают chunks. | SOURCE + DERIVED |
| PRD-010 | Весь контент доступен и сохраняет порядок; цельный AST block не режется посередине. | SOURCE |
| PRD-011 | Progress сохраняется автоматически и восстанавливает semantic position после reload/mode/strategy switch. | SOURCE |
| PRD-012 | Exact duplicate по SHA-256 не создаётся; предлагается открыть существующий документ. | SOURCE |
| PRD-013 | Возможный update по normalized filename/title предлагает replace/separate/cancel; replace сохраняет `documentId` и пытается map progress. | SOURCE |
| PRD-014 | Delete требует явного подтверждения и удаляет document, versions, chunks, settings/progress транзакционно. | SOURCE |
| PRD-015 | После первого online load app shell и локальные документы доступны offline; first offline visit не обещается. | SOURCE |
| PRD-016 | MVP содержит `system/light/dark`; ручной выбор сохраняется глобально. | SOURCE (latest explicit) |
| PRD-017 | HTTPS remote images могут загружаться только при разрешённой preference; relative local resources показывают unsupported placeholder. | SOURCE + DERIVED |
| PRD-018 | Search, editing, backup, sync, notes, bookmarks, folders/assets и backend не входят в MVP. | SOURCE |

### Technical

| ID | Проверяемое правило | Source |
|---|---|---|
| TECH-001 | Greenfield stack: React 19.2 current compatible patch, TypeScript strict, Vite 8.1, React Router 8 Declarative, Node `>=22.22`. | SOURCE + VERIFIED |
| TECH-002 | Domain не зависит от React/DOM/Dexie; UI вызывает use cases/ports; repository — единственная IndexedDB boundary. | SOURCE |
| TECH-003 | Decode/hash/parse/partition/sanitize/highlight выполняются в Web Worker с versioned typed protocol, progress и cancel. | SOURCE |
| TECH-004 | Pipeline использует unified + remark parse/GFM → HAST; heading/source positions и anchors извлекаются до serialization. | SOURCE |
| TECH-005 | Raw HTML инертен; allowlist sanitizer и URL policy выполняются до `SanitizedHtml`; единственная injection boundary — `SafeHtmlChunk`. | SOURCE |
| TECH-006 | Highlight использует lowlight и ограниченные grammars; unknown/error/oversized code получает escaped plain-code fallback. | SOURCE |
| TECH-007 | Internal chunks группируют целые top-level AST nodes; layouts лишь ссылаются на диапазоны chunks. | SOURCE + DERIVED |
| TECH-008 | IndexedDB через Dexie хранит source Blob, versions, chunks, reader state и preferences; UI не хранит полный corpus. | SOURCE |
| TECH-009 | Import/replace выполняются staging batches + short atomic commit; abandoned staging очищается безопасно. | SOURCE |
| TECH-010 | `DB_SCHEMA_VERSION`, `WORKER_PROTOCOL_VERSION` и `PIPELINE_VERSION` независимы; pipeline mismatch перестраивается из source Blob. | SOURCE + DERIVED |
| TECH-011 | Continuous reader использует bounded window с dynamic measurement; TanStack Virtual принимается только после PoC. | SOURCE |
| TECH-012 | Persistent source of truth — IndexedDB; URL хранит route/hash; React state — только ephemeral UI/state machines. | SOURCE |
| TECH-013 | Routes: `/`, `/documents/:documentId`, optional `#heading-id`, `*`; mode/strategy не кодируются в URL. | SOURCE |
| TECH-014 | UI shell: shadcn/ui React Aria base + Tailwind 4 + semantic CSS variables; rendered Markdown — `.reader-content` CSS. | SOURCE (later design) |
| TECH-015 | PWA использует `vite-plugin-pwa` `generateSW`, app-shell precache и user-prompt update; documents не хранятся в Cache Storage. | SOURCE |
| TECH-016 | Resolved package versions фиксирует lockfile; bootstrap проверяет official peer/minimum requirements, не использует случайные prerelease. | DERIVED |

### UX

| ID | Проверяемое правило | Source |
|---|---|---|
| UX-001 | `/` — спокойный vertical library list: header CTA, local-storage explanation, stable activity sort, empty/loading/error/storage states. | SOURCE |
| UX-002 | Reader имеет sticky toolbar, document scroll, max-width prose; TOC persistent только от 1120 px, иначе Sheet. | SOURCE |
| UX-003 | Import — Dialog desktop и Sheet/full-screen mobile с filename, honest stage/progress, cancel и actionable error. | SOURCE |
| UX-004 | Duplicate/update/delete используют один управляемый overlay flow, полные action labels и deterministic focus return. | SOURCE |
| UX-005 | Все core flows работают при `<360`, `360–767`, `768–1119`, `1120–1439`, `>=1440`; 320 px не имеет page overflow. | SOURCE |
| UX-006 | Restore/apply/offline/update/quota/partial error имеют видимое состояние; recoverable error не ограничивается toast. | SOURCE |
| UX-007 | Keyboard, skip link, landmarks, focus-visible, overlay focus trap/return, reduced motion и 44×44 touch targets обязательны. | SOURCE |
| UX-008 | External links явно обозначены и безопасны; code/table имеют локальный overflow; media failure не ломает document flow. | SOURCE |

### Non-functional

| ID | Проверяемое правило | Source |
|---|---|---|
| NFR-001 | File/chunk/DOM/overscan/memory budgets определяются corpus benchmark; release не использует неподтверждённые thresholds. | SOURCE |
| NFR-002 | Forced cancel/termination/reload никогда не меняет текущую ready version и не оставляет видимую partial document. | SOURCE |
| NFR-003 | Security corpus не выполняет scripts/events, не создаёт clobbering IDs и не оставляет unsafe URL/attributes. | SOURCE |
| NFR-004 | Содержимое/diagnostics не отправляются и не логируются; remote image request — явное исключение policy. | SOURCE |
| NFR-005 | Цель — WCAG 2.2 AA; automated a11y дополняется keyboard, NVDA/VoiceOver, zoom/reflow и physical touch smoke. | SOURCE |
| NFR-006 | Release тестирует current stable Chromium/Firefox/WebKit и real iPhone Safari; hard CSS floor — Safari 16.4, Chrome 111, Firefox 128. | VERIFIED + DERIVED |
| NFR-007 | Source Blob позволяет rebuild; quota/eviction объясняются, но MVP честно не обещает backup. | SOURCE |
| NFR-008 | Offline ready documents остаются читаемы; unavailable remote media и update получают отдельные nonfatal states. | SOURCE |
| NFR-009 | UI locale — русский; strings отделены от domain codes; размеры/проценты через `Intl`. | SOURCE |
| NFR-010 | Все phase gates требуют typecheck/lint/tests/build и релевантных E2E/security/performance checks; failed check блокирует completion. | DERIVED |

## Найденные конфликты и разрешение

| ID | Конфликт | Разрешение | Основание |
|---|---|---|---|
| CON-001 | Product blueprint допускал одну качественную тему; позднее решение пользователя/UI blueprint требует light + dark. | MVP содержит `system/light/dark`. | Последнее явное решение пользователя. |
| CON-002 | Technical blueprint предлагал CSS Modules + React Aria; design blueprint — shadcn React Aria base + Tailwind 4. | UI shell следует design blueprint; domain/worker/storage boundaries technical blueprint неизменны; `.reader-content` остаётся отдельным CSS. | Позднее UI-решение в своей области ответственности. |
| CON-003 | Technical blueprint называл React `19.2.x` без patch; React Router 8 сейчас требует совместимый более новый patch и Node 22.22+. | Не пиновать устаревший patch в spec; bootstrap ставит current stable compatible patch и фиксирует lockfile. | Official current compatibility/security. |
| CON-004 | `whole` звучит как единый документ, но technical blueprint требует bounded DOM. | `whole` — один логический section; internal chunks/virtual window сохраняются. | Safety + product rule «без обрезания». |
| CON-005 | Product ожидает remote images online; privacy требует контролировать external requests. | HTTPS images разрешены preference `remoteImagesEnabled=true` по умолчанию, с `no-referrer`, lazy load и видимым глобальным выключателем; relative files unsupported. | Сохраняет поведение и делает исключение прозрачным/отключаемым. |
| CON-006 | Исходные материалы описывали прежде всего длинные технические издания, а последнее решение пользователя определяет продукт как читалку любых Markdown-файлов. | Каноническая сущность — `Document`, route — `/documents/:documentId`, repository — `DocumentRepository`; крупные файлы остаются performance stress case, но не определяют категорию продукта. | Последнее явное решение пользователя; технические ограничения крупных файлов сохраняются. |

## Decision log

| ID | Решение | Статус | Причина / trigger пересмотра |
|---|---|---|---|
| DEC-001 | Browser-only static PWA, без application backend. | SOURCE | Пересмотреть только при обязательном sync/guaranteed backup. |
| DEC-002 | React/Vite/Router Declarative; current compatible stable patches. | SOURCE + VERIFIED | Пересмотреть при repository constraint или failed framework PoC. |
| DEC-003 | `pnpm` + committed lockfile и target scripts. | ASSUMPTION | Reversible до bootstrap; изменить, если среда/организация требует другое. |
| DEC-004 | Clean domain + ports/adapters; UI framework не проникает в domain. | SOURCE | Пересматривать только через ADR. |
| DEC-005 | Web Worker pipeline, staged Dexie commit и raw Blob recovery. | SOURCE | Streaming/native shell может изменить boundary после measured limit. |
| DEC-006 | AST chunks между top-level nodes; no full AST/HTML persistence. | SOURCE | Search/annotations добавляют отдельные records, не отменяя source Blob. |
| DEC-007 | Strict sanitizer + branded HTML boundary + CSP. | SOURCE | Whitelist raw HTML требует отдельного security review/ADR. |
| DEC-008 | TanStack Virtual — candidate gated PoC; fallback — bounded manual window/sections. | SOURCE | Решение финализирует P00-T04. |
| DEC-009 | Semantic anchor, а не pixel offset. | SOURCE | Mapping algorithm калибруется P00-T05. |
| DEC-010 | IndexedDB — persistent source of truth; no global store. | SOURCE | Sync/collaboration может потребовать новый state layer. |
| DEC-011 | shadcn React Aria base + Tailwind 4; open-code primitives reviewed locally. | SOURCE (latest) | Failed component/focus PoC допускает local direct React Aria fallback. |
| DEC-012 | Light/dark/system global preference; no per-document theme. | SOURCE | Per-document personalization post-MVP. |
| DEC-013 | Import success остаётся в library с CTA открыть. | ASSUMPTION | Изменить после usability evidence, не затрагивает data model. |
| DEC-014 | Library list, не cover grid; sort by activity + stable documentId. | SOURCE/DERIVED | Covers/large library могут изменить post-MVP. |
| DEC-015 | Document/window scroll; TOC persistent only `>=1120px`. | SOURCE | Virtualization PoC может доказать необходимость другого scroll root. |
| DEC-016 | Remote HTTPS images default on, disableable; no runtime caching. | DERIVED | Privacy testing может изменить default до release. |
| DEC-017 | `generateSW` prompt update; never silent reload during active import. | SOURCE | Complex runtime cache/background work may require `injectManifest`. |
| DEC-018 | UI Russian, string catalog boundary from first UI task. | SOURCE | Добавление locale не меняет domain errors. |
| DEC-019 | Release target — production-oriented MVP after mandatory PoC gates. | ASSUMPTION | Пользователь может снизить scope до prototype; текущие specs остаются верхней границей. |
| DEC-020 | Каноническая терминология: продукт `Markdown Reader`, сущности `Document`/`DocumentVersion`, идентификатор `documentId`, route `/documents/:documentId`. | SOURCE (latest) | Изменять только вместе с data schema, routes, repository contracts, UX copy и migration decision. |

## Assumptions register

| ID | Предположение | Риск | Обратимая точка |
|---|---|---|---|
| ASM-001 | Нужен production-oriented MVP, хотя поле глубины во входном сообщении не заполнено. | Больше hardening tasks. | До P05; отдельные phases можно остановить после walking skeleton. |
| ASM-002 | После import пользователь остаётся в library. | Может ожидать auto-open. | Один navigation policy в ImportFlow. |
| ASM-003 | `pnpm` приемлем. | Локальная среда может использовать npm. | P00-T01 до commit lockfile. |
| ASM-004 | Remote HTTPS images включены по умолчанию, но прозрачно отключаемы. | Privacy expectation. | Preference default до release migration. |
| ASM-005 | Название `Markdown Reader` принято как каноническое рабочее имя; neutral blue accent остаётся рабочим визуальным допущением. | Поздняя смена brand accent. | Semantic brand tokens/strings. |
| ASM-006 | Исходный файл сохраняется пользователем вне приложения. | Eviction может привести к потере документа. | Storage copy + backup NEXT; нельзя обещать сохранность. |

## Open questions

| ID | Вопрос | Блокирует | Временное решение |
|---|---|---|---|
| OPEN-001 | Финальный brand accent. | Не блокирует MVP architecture. | Semantic neutral-blue accent (`ASM-005`). |

Блокирующих пользовательских open questions нет. Численные thresholds являются обязательными результатами PoC, а не вопросами, которые можно честно решить предпочтением.

## Deferred decisions

| ID | Решение отложено | Вернуться когда |
|---|---|---|
| DFR-001 | Максимальный file size, node/chunk cost, DOM window, overscan и anchor tolerance. | После P00-T02/P00-T04/P00-T05 на зафиксированном corpus/device matrix. |
| DFR-002 | Финальный список highlight grammars и auto-detect confidence. | После corpus pipeline benchmark; до P02-T01. |
| DFR-003 | Backup/export format. | После MVP либо раньше, если eviction делает release неприемлемым. |
| DFR-004 | Full-text search index/schema. | После стабильных block anchors и pipeline versioning. |
| DFR-005 | Typography user controls. | После visual QA двух базовых тем. |
| DFR-006 | Cross-tab coordination guarantees. | Когда E2E докажет реальный конфликт; MVP лишь не должен повреждать данные. |

### Evidence updates

| ID | Update | Status |
|---|---|---|
| DFR-001 | P00-T02 добавил `src/domain/content/pipeline-limits.ts` и `docs/benchmarks/pipeline-spike.md`: proposal для `maxFileBytes=1_250_000`, chunk cost, oversized-node/code fallback и batch shape подтверждён deterministic corpus/security/bench tests. | Частично закрыто только для content pipeline. DOM window, overscan, browser memory и anchor tolerance остаются за P00-T04/P00-T05/P00-T06. |
| DFR-002 | P00-T02 предлагает expanded explicit lowlight set: `bash`, `c`, `cpp`, `csharp`, `css`, `diff`, `go`, `graphql`, `ini`, `java`, `javascript`, `json`, `kotlin`, `less`, `lua`, `makefile`, `markdown`, `objectivec`, `perl`, `php`, `plaintext`, `python`, `r`, `ruby`, `rust`, `scss`, `shell`, `sql`, `swift`, `typescript`, `wasm`, `xml`, `yaml`; aliases documented in spike report. Auto-detect остаётся gated by size/confidence и не должен подсвечивать low/medium-confidence unlabeled code. | Proposal до production rerun в P02-T01. |

## Трассировка

`AC` означает acceptance criteria соответствующего task; точные проверки перечислены в task и `codex-spec/testing-and-quality.md`.

| Requirements | Каноническая спецификация | Tasks | Acceptance / test |
|---|---|---|---|
| PRD-001, TECH-001, TECH-013, TECH-016, DEC-020 | `codex-spec/project-source-of-truth.md`, `codex-spec/architecture/system-architecture.md`, `codex-spec/architecture/data-and-state.md` | P00-T01, P01-T01, P01-T02 | Build SPA; canonical Document contracts/schema; route smoke; no backend runtime |
| PRD-002, TECH-003, TECH-009 | F01, `codex-spec/architecture/system-architecture.md`, `codex-spec/architecture/data-and-state.md` | P01-T03, P02-T01, P02-T02 | Import/cancel/forced failure integration + E2E |
| PRD-003, UX-001 | F01, `codex-spec/design/screens-and-user-flows.md` | P01-T04, P04-T01 | Reloaded library; title/progress/sort/focus tests |
| PRD-004, TECH-004, TECH-006 | F02 | P00-T02, P02-T01 | Corpus snapshots/invariants; footnote/code/table fixtures |
| PRD-005, UX-002 | F04, `codex-spec/design/screens-and-user-flows.md` | P03-T01 | TOC hierarchy + hash jump in both modes |
| PRD-006, TECH-011 | F03 | P00-T04, P03-T02 | Bounded DOM, no sustained gaps/jumps, full reachability |
| PRD-007, PRD-009 | F04 | P03-T03 | Section count/pager/layout strategies |
| PRD-008 | F04, `codex-spec/architecture/data-and-state.md` | P00-T02, P03-T03 | Measured threshold; modeOrigin auto/user tests |
| PRD-010, TECH-007 | F02 | P00-T02, P02-T01 | Property tests: no loss/duplication/reorder/split-node |
| PRD-011, TECH-012 | F04, `codex-spec/architecture/data-and-state.md` | P00-T05, P03-T04 | Reload/mode/strategy anchor tolerance tests |
| PRD-012, PRD-013 | F05 | P02-T03, P04-T02 | Exact duplicate and replace/separate/cancel E2E |
| PRD-014, UX-004 | F05, `codex-spec/design/screens-and-user-flows.md` | P04-T01 | Confirm/delete transaction/focus/error tests |
| PRD-015, TECH-015, NFR-008 | F06 | P05-T02 | Installed offline E2E and update gating |
| PRD-016, TECH-014 | `codex-spec/design/ui-design-system.md`, F06 | P05-T01 | No-flash theme; two-theme visual/a11y checks |
| PRD-017, UX-008 | F02, F06 | P02-T01, P03-T03, P05-T03 | URL policy/security corpus/offline media states |
| PRD-018 | `codex-spec/project-source-of-truth.md`, `AGENTS.md` | All | Dependency/routes review: excluded features absent |
| TECH-002, TECH-008, TECH-010 | `codex-spec/architecture/system-architecture.md`, `codex-spec/architecture/data-and-state.md` | P01-T02, P00-T03 | Import-boundary lint/tests; migration/rebuild tests |
| TECH-005, NFR-003, NFR-004 | F02, `codex-spec/architecture/system-architecture.md` | P00-T02, P02-T01, P05-T04 | Malicious corpus + CSP + network/log audit |
| UX-003, UX-006 | `codex-spec/design/screens-and-user-flows.md`, F01 | P02-T02, P05-T03 | State-machine component tests; actionable errors |
| UX-005, UX-007, NFR-005 | `codex-spec/design/ui-design-system.md`, `codex-spec/design/screens-and-user-flows.md` | P00-T06, P03-T04, P05-T01, P05-T04 | 320/zoom/keyboard/NVDA/VoiceOver/axe matrix |
| NFR-001, NFR-006 | F00, `codex-spec/testing-and-quality.md` | P00-T02, P00-T04, P00-T06 | Stored benchmark report and browser/device gate |
| NFR-002, NFR-007 | F01, F06, `codex-spec/architecture/data-and-state.md` | P00-T03, P05-T03 | Termination/quota/reprocess recovery tests |
| NFR-009 | `codex-spec/design/ui-design-system.md`, `codex-spec/design/screens-and-user-flows.md` | P01-T01, P05-T01 | String catalog/Intl/long-Russian-copy checks |
| NFR-010 | `codex-spec/testing-and-quality.md`, `codex-spec/implementation-roadmap.md`, tasks | P05-T05 | All required commands green; final checklist signed |
