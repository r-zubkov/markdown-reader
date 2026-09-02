# Screens and user flows

## Screen catalog

| ID | Surface | Route/presentation | Requirements |
|---|---|---|---|
| L-01 | Library | `/` | PRD-003, UX-001, UX-005 |
| R-01 | Reader | `/documents/:documentId[#heading-id]` | PRD-004–011, UX-002, UX-005–008 |
| O-01 | Import | Dialog desktop; Sheet/full-screen mobile | PRD-002, UX-003 |
| O-02 | Duplicate/update | State inside same import overlay | PRD-012, PRD-013, UX-004 |
| O-03 | Delete | AlertDialog from DocumentItem menu | PRD-014, UX-004 |
| O-04 | Reading settings | Popover desktop; Sheet narrow | PRD-008, PRD-009, PRD-016 |
| G-01 | Platform statuses | Banner/toast/live region in shell | PRD-015, PRD-017, UX-006 |
| E-01 | Missing/error route | `*` or failed reader route | TECH-013, UX-006 |

## L-01 Library

**Goal:** увидеть локальные Markdown-документы, продолжить чтение, начать import/replace/delete и понять, где хранятся данные.

**Regions:** `AppHeader`; `main` with `h1 Библиотека`; local-storage explanation; optional `StorageStatusBanner`; `DocumentList` or empty/error state. Page scroll; list max 880 px.

**DocumentItem input:** title, optional nonduplicate filename, progress/status, stable action labels, problem badge if reprocess needed. Sort: `(lastOpenedAt ?? updatedAt)` descending, then `documentId` ascending. Reordering is applied after navigation/import result, never under pointer during click.

**Actions and transitions**

- Header/empty CTA → O-01 with focus owner.
- Title/«Открыть»/«Продолжить» → R-01; name includes document title for assistive tech.
- «Заменить файлом» → O-01 with explicit target `documentId`.
- «Удалить документ» → O-03.
- Theme/privacy menu → preference action, immediate visible result.

**States**

| State | Visible behavior | Recovery/focus |
|---|---|---|
| Initial loading | 2–4 DocumentItem-shaped skeletons; main `aria-busy` | Resolves without full-screen spinner |
| Empty | «В библиотеке пока нет документов», one `.md`/local copy, CTA | Focus route heading; CTA next |
| Ready | Ordered list, progress text + bar | Normal |
| Partial/reprocess | Affected item remains; action «Подготовить заново» | Other documents work |
| Metadata error | In-main explanation + «Повторить» | No clear-storage first action |
| DB unavailable/fatal | Explain browser mode/storage; import disabled with reason | Retry/help/library source files retained externally |
| Storage warning | Persistent concrete banner | Request persistence/explain/free space |
| Offline | Ready state unchanged | Only remote/update impact shown globally |

**Long content/responsive:** title ≤2 lines in item; filename hidden visually below 360 if needed; progress/actions wrap, no target below 44 px. Duplicate titles remain distinct via filename/accessible labels.

**Keyboard/accessibility:** `<ul>/<li>` semantics; no nested interactive container; menu arrow/Escape behavior; progress has value + visible text. After import focus goes to result CTA/new item; after delete to next/previous/empty CTA.

**Acceptance**

- Empty → import → ready works without reload.
- Reload reconstructs same documents/progress from IndexedDB.
- 320 px with long Russian titles has no page overflow or lost action.
- All actions and focus return work keyboard-only.
- Offline does not disable opening ready document.

## R-01 Reader

**Goal:** читать весь document, ориентироваться по TOC и менять presentation without losing position.

**Regions:** first skip link «К тексту документа»; sticky `ReaderToolbar`; optional persistent `TableOfContents`; `main > article`; in sections mode `SectionContext` and `SectionPager`; inline status region. Document/window is scroll root.

**Toolbar:** back link; ellipsized document title with full accessible name; TOC trigger; visible/accessible progress; settings trigger. No filled primary action during reading.

**Entry resolution:**

1. Load Document/current ready metadata.
2. If URL hash valid, choose heading anchor; else saved anchor; else start.
3. Load required section/window and show restore skeleton/status.
4. Stabilize measurements, position anchor, then mark ready/update location.
5. Exact restore is silent; approximate/none shows inline explanation and «В начало».

**Modes**

- Continuous: virtual bounded chunks form one visual stream; progressive before/after space is invisible/skeleton only while loading. No load-more controls.
- Sections: render current section through bounded chunk access; show `Раздел N из M · title`; Next stronger than Back but both navigation semantics.
- TOC always represents whole outline. Active item updates throttled; explicit selection updates hash with replace policy and closes mobile Sheet.

**States**

| State | Behavior |
|---|---|
| Restoring | Toolbar/column stable, status + nearby skeleton, article `aria-busy` |
| Continuous ready | Bounded window, progress, active TOC |
| Sections ready | One section + pager/counter |
| Progressive window | Local placeholders only, no page spinner |
| Approximate restore | Inline info once, Continue/Start actions |
| No headings | TOC trigger hidden/disabled with explanation; reading/chunking work |
| Empty document | Clear empty-document message; library back action |
| Unsafe `whole` | Option unavailable/rejected with reason and `auto` recommendation |
| Safe fallback chunk | Literal/escaped block placeholder/content; other chunks work |
| Remote media blocked/offline/error | In-flow placeholder with alt/domain/retry when appropriate |
| Stale derived data | Controlled reprocess; safe old version may remain readable per security policy |
| Missing document | Local-link explanation + Library/Add actions |
| Fatal unexpected | Route error state, retry/library; no raw stack |

**Interactions/focus:** keyboard TOC activation moves focus to heading/reader marker after stabilization; pointer does not steal focus. Mode/strategy capture anchor, set controls busy, rebuild view, restore anchor, announce result. Before unmounting a focused virtual chunk, pin it or move focus to stable marker. Back/route leave flushes best-effort state without blocking.

**Overflow/responsive:** persistent TOC only ≥1120; otherwise Sheet. At <768 toolbar keeps back/title/TOC/settings, secondary details move to settings. Code/table scroll locally; image resize remeasures. `scroll-margin-top = toolbar + 16px`. 320 px has no page-level overflow.

**Acceptance**

- Every source block is reachable in both modes and via appropriate TOC/pager navigation.
- Reload and mode/strategy change satisfy measured anchor tolerance or show defined fallback.
- DOM/window count remains within measured budget on large corpus.
- Keyboard sequence TOC → article → pager works; focus never disappears into unmounted content.
- Dynamic content does not produce sustained blank gaps/jumps beyond PoC budget.

## O-01 Import

**Goal:** choose exactly one `.md`, understand local processing, cancel safely and recover from validation/storage/worker errors.

**Layout:** title/description; idle `FileDropField`; running filename + human stage + honest progress; result/error; footer. Desktop 480–560 px Dialog; narrow screen full-height/nearly-full-height Sheet with scrollable body, sticky footer, `dvh` and safe area.

**State machine**

`idle → validating → hashing/parsing/preparing/saving → finalizing → success`. Branches: `invalid`, `decision(O-02)`, `cancelling → cancelled`, `failed`. Close before start is immediate. During running Escape/outside click cannot silently cancel: show cancel intent or keep modal until cancel handshake. During finalizing, mutation controls disabled but tab termination is still safely recoverable.

**File rules:** picker and drag have identical result; accept one case-insensitive `.md`; multiple/other files produce inline error and no partial import. Show filename/size; do not advertise file maximum until DFR-001 fixed. MIME alone never rejects a valid `.md`.

**Stages shown:** «Проверяем файл», «Разбираем структуру», «Подготавливаем разделы», «Сохраняем документ». Indeterminate if percentage is not honest. Announce stage/large milestones only.

**Errors:** invalid UTF-8 → resave/select other; too large → show measured limit and keep original safe; quota → existing library unchanged, free space/delete/retry; worker/protocol → retry/update guidance; cancellation → library unchanged. Every message says what remains safe.

**Success:** Document appears ready; actions «Открыть документ» and «Готово». Default policy remains in library (`ASM-002`).

**Acceptance:** keyboard picker and DropZone alternative; cancel/close/worker termination publishes nothing; mobile Safari viewport/focus works; errors provide a concrete next action.

## O-02 Duplicate/update

This is a state of the same ImportFlow/overlay, not nested dialog.

### Exact duplicate

- Message names existing Document, not hash.
- Actions: «Открыть существующую» and «Закрыть».
- No second Document/staging publication; opening uses existing state.

### Possible update

- Show «В библиотеке» and «Выбранный файл» title/filename/size, not fabricated diff.
- If one candidate: actions «Заменить документ», «Добавить отдельно», «Отмена».
- If multiple candidates: user explicitly selects target, then same actions; no automatic choice.
- Replace continues processing in same overlay; old ready Document remains usable until commit.
- Result states: exact restore, approximate restore, no restore, failure/quota/cancel. Mapping confidence has plain-language explanation and is repeated briefly in Reader when needed.

**Acceptance:** three outcomes are distinct/keyboard accessible; error leaves old ready version/current pointer unchanged; exact duplicate cannot be added through this branch.

## O-03 Delete

AlertDialog title `Удалить «{title}»?`; description says Document, settings and progress in this browser will be removed and there is no Undo. Initial focus on «Отмена»; destructive action «Удалить документ».

States: confirm → deleting (controls disabled) → success/inline recoverable error. No optimistic item removal. Escape cancels only before mutation. After cancel focus returns to menu trigger; after success to next item, previous item or empty CTA. Error keeps item and offers Retry/Cancel.

**Acceptance:** cannot delete with one menu activation; complete consequence text is accessible; repository failure keeps Document visible/current data unchanged.

## O-04 Reading settings

Popover desktop when content fits; Sheet at narrow width/height. Immediate persisted choices:

- Reading mode RadioGroup: `Непрерывно`, `По разделам` with descriptions.
- Split strategy RadioGroup: `Автоматически`, `По H1`, `По H2`, `Весь документ`; description says it defines sections and internal safe chunks remain.
- In continuous mode, strategy choice is saved but document remains one stream; UI explicitly states strategy affects section mode.
- Theme group/link: `Системная/Светлая/Тёмная`, global not per-document.

Before async apply capture anchor; selected controls become busy/disabled; success returns focus to selected option and announces restore. Failure restores previous value. Unavailable `whole` remains visible with adjacent reason and `auto` alternative.

**Acceptance:** choices work keyboard-only, survive reload at correct ownership, maintain anchor tolerance/fallback, and do not depend on pressing «Готово».

## G-01 Platform statuses

One persistent banner max, priority: fatal storage → actionable storage risk → update → offline info. Short confirmations use toast; actionable failures stay inline/banner. Banner appearance must compensate layout so Reader anchor does not jump.

| Event | Message/action |
|---|---|
| Offline | Local documents remain available; external images/update may not. No error styling. |
| PWA update | «Доступна новая версия»; Update/Later; Update disabled while import/finalize active. |
| Persistence denied | Explain browser may clear data; retain original file; action to retry/explain. |
| Quota risk | Concrete estimate state when reliable; manage documents/retry, never automatic deletion. |
| Theme/privacy change/copy | Short polite toast if visible state alone is insufficient. |

Update never auto reloads. Toast respects bottom safe area and does not cover pager. Live region deduplicates repeated online/scroll events.

## E-01 Missing/fatal route

- `*`: «Страница не найдена» + link to Library.
- Missing local `documentId`: explain link is local to a browser/profile + Library/Add actions.
- Unexpected reader/library error: short user message, Retry and Library when possible; diagnostics code may be copied without content/stack.
- Route change focus moves to error heading.

## Cross-flow scenarios

### First import → read → reload

1. Empty L-01 → Add opens O-01 with focus in file action.
2. File validation and worker progress; atomic commit creates ready records.
3. Success remains in L-01, announces result, focuses Open/new item.
4. Open R-01; auto mode uses measured analysis, `modeOrigin=auto`.
5. Scroll/controller persists semantic anchor/progress.
6. Reload resolves saved state/window, exact restore is silent; approximate displays notice.

Persisted result: Document, ready DocumentVersion, source Blob, chunks/layouts, ReaderState, preferences. No AST/full DOM/session reducer persisted.

### TOC and mode/strategy switch

1. Open TOC and activate heading.
2. Resolve heading-to-chunk/section, load range, stabilize, update hash/current anchor.
3. Open settings; capture anchor; choose new mode/strategy.
4. Build presentation from precomputed layout; restore same/nearest block; persist choice as `modeOrigin=user` for mode.
5. If exact mapping fails, show approximate notice rather than jumping silently.

### Replace with changed version

1. Explicit Replace or similar import yields candidate decision.
2. User selects target/Replace; stage new version while old remains current.
3. Complete validates all chunks/layouts and maps old anchor with confidence.
4. Atomic transaction switches current version and ReaderState.
5. UI reports mapping confidence; failed commit leaves old version unchanged.

### Failure/recovery

- Cancel/worker crash before commit → abort job; no library item.
- Reload with abandoned staging → startup cleanup; current ready records untouched.
- Stale pipeline → rebuild from Blob as staging; current safe version remains until atomic switch.
- Corrupt derived chunk → safe partial placeholder/reprocess; corrupt/missing source → ask to reimport.
- Offline → ready library/reader operate; remote images placeholder; update waits.
